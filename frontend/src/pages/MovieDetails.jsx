import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Film, RefreshCw, Trash2, EyeOff } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { AuthContext } from '../context/AuthContext';
import ImageSelectorModal from '../components/ImageSelectorModal';
import WatchOptionsModal from '../components/WatchOptionsModal';
import CommentSection from '../components/CommentSection';
import MediaCast from '../components/MediaCast';
import { useMovieStore } from '../features/movie/store/useMovieStore';
import MovieRawModal from '../features/movie/components/MovieRawModal';
import MovieHeader from '../features/movie/components/MovieHeader';
import MovieActionButtons from '../features/movie/components/MovieActionButtons';
import MovieTrailers from '../features/movie/components/MovieTrailers';
import MovieHideModal from '../features/movie/components/MovieHideModal';

const MovieDetails = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const { user } = useContext(AuthContext);

  const [showHideModal, setShowHideModal] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [imageSelectorType, setImageSelectorType] = useState('poster'); // 'poster' or 'backdrop'
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);

  const {
    movieDetails,
    setMovieDetails,
    loadingDetails,
    fetchMovieDetails,
    fetchLists,
    setShowRawModal,
    correctingFile,
    correctId,
    correctTitle,
    correctYear,
    setCorrecting,
    setModalError,
    setCorrectMode,
    setCorrectingFile,
    fetchRawData
  } = useMovieStore();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchMovieDetails(tmdbId);
  }, [tmdbId, fetchMovieDetails]);

  useEffect(() => {
    if (movieDetails) {
      fetchLists(tmdbId);
    }
  }, [movieDetails, tmdbId, fetchLists]);

  const handleImageSelected = (newPath) => {
    setMovieDetails(prev => {
      if (!prev) return prev;
      if (imageSelectorType === 'poster') {
        return { ...prev, poster_path: newPath };
      } else {
        return { ...prev, backdrop_path: newPath };
      }
    });
  };

  const handleForceRemove = async () => {
    const confirmed = await showConfirm(`Are you sure you want to remove this movie and all its logs from your database?`);
    if (!confirmed) {
      return;
    }
    try {
      await api.post('/media/force-remove', {
        tmdbId: parseInt(tmdbId, 10),
        type: 'movie'
      });
      showAlert('Movie removed successfully.', 'success');
      navigate('/movies');
    } catch (err) {
      console.error('Failed to remove movie:', err);
      showAlert('Failed to remove movie: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const parseFilenameFromPath = (filePath) => {
    const filename = filePath.split(/[/\\]/).pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;

    const yearMatch = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
    let year = '';
    let title = nameWithoutExt;
    if (yearMatch) {
      year = yearMatch[1];
      title = nameWithoutExt.substring(0, nameWithoutExt.indexOf(yearMatch[0]));
    }

    const cleanTitleStr = title.replace(/[._-]/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|uhd|bluray|brrip|bdrip|dvdrip|webrip|web-dl|h264|x264|h265|x265|hevc|dd5\s*1|aac|dts|remux|xvid|divx)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { title: cleanTitleStr, year };
  };

  const submitCorrection = async (targetNewTmdbId = null, targetImdbId = null) => {
    setCorrecting(true);
    setModalError('');
    try {
      const payload = {
        type: 'movie'
      };

      if (correctingFile) {
        payload.fileId = correctingFile.id;
      } else {
        payload.oldTmdbId = movieDetails?.localId || movieDetails?.id;
      }

      if (targetNewTmdbId) {
        payload.newTmdbId = targetNewTmdbId;
      } else if (targetImdbId) {
        payload.imdbId = targetImdbId;
      } else if (correctId) {
        if (correctId.trim().startsWith('tt')) {
          payload.imdbId = correctId.trim();
        } else {
          payload.newTmdbId = parseInt(correctId.trim(), 10);
        }
      } else if (correctTitle) {
        payload.title = correctTitle;
        if (correctYear) payload.releaseYear = correctYear;
      } else {
        setModalError('Please specify correction criteria.');
        setCorrecting(false);
        return;
      }

      const endpoint = correctingFile ? '/media/correct-file' : '/media/correct';
      const res = await api.post(endpoint, payload);
      showAlert(res.data.message || 'Correction successful!', 'success');
      setShowRawModal(false);
      setCorrectMode(false);
      setCorrectingFile(null);
      navigate(`/movies/${res.data.media.tmdbId}`, { replace: true });
      window.location.reload();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to apply correction.');
    } finally {
      setCorrecting(false);
    }
  };

  const handleWatchOptionsSelect = async ({ choice, watchedAt }) => {
    if (!movieDetails) return;
    try {
      if (choice === 'watching-now') {
        await api.post('/media/active-session', {
          tmdbId: movieDetails.id,
          type: 'movie',
          title: movieDetails.title,
          overview: movieDetails.overview,
          releaseDate: movieDetails.release_date,
          posterPath: movieDetails.poster_path
        });
        showAlert('Started watching now', 'info');
      } else if (choice === 'removed-last') {
        setMovieDetails(prev => ({
          ...prev,
          isWatched: watchedAt
        }));
        showAlert('Removed watch entry', 'info');
      } else {
        await api.post('/media/watch', {
          tmdbId: movieDetails.id,
          type: 'movie',
          title: movieDetails.title,
          overview: movieDetails.overview,
          releaseDate: movieDetails.release_date,
          posterPath: movieDetails.poster_path,
          watchedAt
        });
        setMovieDetails(prev => ({
          ...prev,
          isWatched: true
        }));
        showAlert('Marked as watched', 'success');
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
      showAlert('Failed to update watch status', 'error');
    }
  };

  const handleToggleCollection = async () => {
    if (!movieDetails) return;
    const isCurrentlyCollected = movieDetails.isCollected;

    if (isCurrentlyCollected) {
      const confirmed = await showConfirm(`Are you sure you want to remove entire movie "${movieDetails.title}" from your collection?`);
      if (!confirmed) return;
    }

    try {
      await api.post('/media/collect', {
        tmdbId: movieDetails.id,
        type: 'movie',
        title: movieDetails.title,
        remove: isCurrentlyCollected
      });

      setMovieDetails(prev => ({
        ...prev,
        isCollected: !isCurrentlyCollected
      }));
    } catch (err) {
      console.error('Failed to toggle collection:', err);
    }
  };

  if (loadingDetails) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Loading Movie specifications...</span>
        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Back Button */}
      {!movieDetails && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>
      )}

      {!movieDetails ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px auto', maxWidth: '600px' }}>
          <Film size={48} style={{ color: 'var(--danger)', marginBottom: '16px' }} />
          <h3>Failed to Load Movie Details</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The movie details could not be retrieved from TMDB.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Go Back
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowRawModal(true); fetchRawData(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={16} /> Correct Match / Local Data
            </button>
            <button
              className="btn"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleForceRemove}
            >
              <Trash2 size={16} /> Remove Movie
            </button>
          </div>
        </div>
      ) : (
        <>
          <MovieHeader
            scrollY={scrollY}
            onEditPoster={() => {
              setImageSelectorType('poster');
              setImageSelectorOpen(true);
            }}
            onEditBackdrop={() => {
              setImageSelectorType('backdrop');
              setImageSelectorOpen(true);
            }}
          >
            <MovieActionButtons 
              onWatchOptions={() => setIsWatchOptionsOpen(true)}
            />
          </MovieHeader>

          <div className="details-content-wrapper" style={{ marginTop: '-40px' }}>
            <div className="details-layout">
              <div className="details-left-col">
                {/* Spacer to align with right col since poster is handled in header layout */}
              </div>
              <div className="details-right-col">
                {/* Overview */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Overview</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '1.05rem' }}>{movieDetails.overview || 'No overview available.'}</p>
                </div>

                <MediaCast cast={movieDetails.cast} />
                <MovieTrailers />
                <CommentSection mediaId={movieDetails.id} mediaType="movie" />
              </div>
            </div>
          </div>

          {/* Danger Zone / Remove Button at the bottom */}
          {movieDetails.isCollected && user?.role === 'admin' && (
            <div style={{ marginTop: '48px', borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
                onClick={handleToggleCollection}
              >
                <Trash2 size={18} />
                <span>Remove Movie from Collection</span>
              </button>
            </div>
          )}

          {/* Hide Button for all users */}
          <div style={{ marginTop: movieDetails.isCollected && user?.role === 'admin' ? '12px' : '48px', borderTop: movieDetails.isCollected && user?.role === 'admin' ? 'none' : '1px solid var(--border-color)', paddingTop: movieDetails.isCollected && user?.role === 'admin' ? '0' : '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              style={{
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}
              onClick={() => setShowHideModal(true)}
            >
              <EyeOff size={18} />
              <span>Hide this Movie</span>
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      <MovieRawModal 
        tmdbId={tmdbId} 
        parseFilenameFromPath={parseFilenameFromPath} 
        submitCorrection={submitCorrection} 
      />

      <MovieHideModal 
        isOpen={showHideModal}
        onClose={() => setShowHideModal(false)}
      />

      {movieDetails && (
        <ImageSelectorModal
          isOpen={imageSelectorOpen}
          onClose={() => setImageSelectorOpen(false)}
          mediaType="movie"
          tmdbId={movieDetails.id}
          imageType={imageSelectorType}
          currentPath={imageSelectorType === 'poster' ? movieDetails.poster_path : movieDetails.backdrop_path}
          onSelect={handleImageSelected}
        />
      )}

      {movieDetails && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={{
            tmdbId: movieDetails.id,
            type: 'movie',
            title: movieDetails.title,
            overview: movieDetails.overview,
            releaseDate: movieDetails.release_date,
            posterPath: movieDetails.poster_path,
            isWatched: movieDetails.isWatched
          }}
          onSelect={handleWatchOptionsSelect}
          onWatchStatusChange={(newIsWatched) => setMovieDetails(prev => ({ ...prev, isWatched: newIsWatched }))}
        />
      )}
    </div>
  );
};

export default MovieDetails;

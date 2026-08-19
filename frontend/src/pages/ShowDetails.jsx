import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Tv, RefreshCw, Trash2, EyeOff } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { AuthContext } from '../context/AuthContext';
import ImageSelectorModal from '../components/ImageSelectorModal';
import WatchOptionsModal from '../components/WatchOptionsModal';
import CommentSection from '../components/CommentSection';
import MediaCast from '../components/MediaCast';
import { useShowStore } from '../features/show/store/useShowStore';
import ShowRawModal from '../features/show/components/ShowRawModal';
import ShowHeader from '../features/show/components/ShowHeader';
import ShowActionButtons from '../features/show/components/ShowActionButtons';
import ShowTrailers from '../features/show/components/ShowTrailers';
import ShowHideModal from '../features/show/components/ShowHideModal';
import ShowSeasons from '../features/show/components/ShowSeasons';

const ShowDetails = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = useModal();
  const { user } = useContext(AuthContext);

  const [showHideModal, setShowHideModal] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [imageSelectorType, setImageSelectorType] = useState('poster'); // 'poster' or 'backdrop'
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);

  const {
    showDetails,
    setShowDetails,
    loadingDetails,
    fetchShowDetails,
    fetchLists,
    setShowRawModal,
    fetchRawData,
    activeSeason,
    handleSelectSeason
  } = useShowStore();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const urlSeason = queryParams.get('season');
    fetchShowDetails(tmdbId, urlSeason);
  }, [tmdbId, fetchShowDetails, location.search]);

  useEffect(() => {
    if (showDetails) {
      fetchLists(tmdbId);
    }
  }, [showDetails, tmdbId, fetchLists]);

  const handleImageSelected = (newPath) => {
    setShowDetails(prev => {
      if (!prev) return prev;
      if (imageSelectorType === 'poster') {
        return { ...prev, poster_path: newPath };
      } else {
        return { ...prev, backdrop_path: newPath };
      }
    });
  };

  const handleForceRemove = async () => {
    const confirmed = await showConfirm(`Are you sure you want to remove this show and all its logs from your database?`);
    if (!confirmed) {
      return;
    }
    try {
      await api.post('/media/force-remove', {
        tmdbId: parseInt(tmdbId, 10),
        type: 'tv'
      });
      showAlert('Show removed successfully.', 'success');
      navigate('/shows');
    } catch (err) {
      console.error('Failed to remove show:', err);
      showAlert('Failed to remove show: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleWatchOptionsSelect = async ({ choice, watchedAt, addSequentially }) => {
    if (!showDetails) return;

    try {
      await api.post('/media/tv/watch-bulk', {
        tmdbId: showDetails.id,
        type: 'show',
        title: showDetails.name,
        posterPath: showDetails.poster_path,
        watched: true,
        watchedAt,
        choice,
        addSequentially
      });
      showAlert(`Marked show as watched`, 'success');
      const detailsRes = await api.get(`/media/tv/${tmdbId}`);
      setShowDetails(detailsRes.data);
      if (activeSeason) handleSelectSeason(tmdbId, activeSeason);
    } catch (err) {
      console.error('Failed to log bulk watch:', err);
      showAlert('Failed to update watch status', 'error');
    }
  };

  const handleToggleCollection = async () => {
    if (!showDetails) return;
    const isCurrentlyCollected = showDetails.isCollected;

    if (isCurrentlyCollected) {
      const confirmed = await showConfirm(`Are you sure you want to remove entire show "${showDetails.name}" and all its logs?`);
      if (!confirmed) return;
    }

    try {
      await api.post('/media/collect', {
        tmdbId: showDetails.id,
        type: 'tv',
        title: showDetails.name,
        remove: isCurrentlyCollected
      });

      setShowDetails(prev => ({
        ...prev,
        isCollected: !isCurrentlyCollected,
        collectedEpisodes: isCurrentlyCollected ? [] : prev.collectedEpisodes,
        watchedEpisodes: isCurrentlyCollected ? [] : prev.watchedEpisodes
      }));
      if (activeSeason) handleSelectSeason(tmdbId, activeSeason);
    } catch (err) {
      console.error('Failed to toggle show collection:', err);
    }
  };

  if (loadingDetails) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Loading TV Show specifications...</span>
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
      {!showDetails && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>
      )}

      {!showDetails ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px auto', maxWidth: '600px' }}>
          <Tv size={48} style={{ color: 'var(--danger)', marginBottom: '16px' }} />
          <h3>Failed to Load Show Details</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The TV show details could not be retrieved from TMDB.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Go Back
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowRawModal(true); fetchRawData(tmdbId); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
              <Trash2 size={16} /> Remove Show
            </button>
          </div>
        </div>
      ) : (
        <>
          <ShowHeader
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
            <ShowActionButtons 
              onWatchOptions={() => setIsWatchOptionsOpen(true)}
              activeSeason={activeSeason}
            />

            {/* Overview */}
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Overview</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '1.05rem' }}>{showDetails.overview || 'No overview available.'}</p>
            </div>

            <ShowSeasons />
            <MediaCast cast={showDetails.cast} />
            <ShowTrailers />
            <CommentSection mediaId={showDetails.id} mediaType="tv" />
          </ShowHeader>

          {/* Danger Zone / Remove Button at the bottom */}
          {showDetails.isCollected && user?.role === 'admin' && (
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
                <span>Remove Show from Collection</span>
              </button>
            </div>
          )}

          {/* Hide Button for all users */}
          <div style={{ marginTop: showDetails.isCollected && user?.role === 'admin' ? '12px' : '48px', borderTop: showDetails.isCollected && user?.role === 'admin' ? 'none' : '1px solid var(--border-color)', paddingTop: showDetails.isCollected && user?.role === 'admin' ? '0' : '24px', display: 'flex', justifyContent: 'center' }}>
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
              <span>Hide this Show</span>
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      <ShowRawModal tmdbId={tmdbId} />

      <ShowHideModal 
        isOpen={showHideModal}
        onClose={() => setShowHideModal(false)}
      />

      {showDetails && (
        <ImageSelectorModal
          isOpen={imageSelectorOpen}
          onClose={() => setImageSelectorOpen(false)}
          mediaType="tv"
          tmdbId={showDetails.id}
          imageType={imageSelectorType}
          currentPath={imageSelectorType === 'poster' ? showDetails.poster_path : showDetails.backdrop_path}
          onSelect={handleImageSelected}
        />
      )}

      {showDetails && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={{
            tmdbId: showDetails.id,
            type: 'show',
            title: showDetails.name,
            overview: showDetails.overview,
            releaseDate: showDetails.first_air_date,
            posterPath: showDetails.poster_path,
            isWatched: showDetails.isWatched
          }}
          onSelect={handleWatchOptionsSelect}
          onWatchStatusChange={(newIsWatched) => setShowDetails(prev => ({ ...prev, isWatched: newIsWatched }))}
        />
      )}
    </div>
  );
};

export default ShowDetails;

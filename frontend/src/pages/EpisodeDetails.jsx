import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Tv, Star, Calendar, Clock, Check, Eye, EyeOff, Play, Plus } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { AuthContext } from '../context/AuthContext';
import WatchOptionsModal from '../components/WatchOptionsModal';
import RequestButton from '../components/RequestButton';
import MediaCast from '../components/MediaCast';
import CommentSection from '../components/CommentSection';
import ReactionPicker from '../components/ReactionPicker';

const EpisodeDetails = () => {
  const { tmdbId, seasonNumber, episodeNumber } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert } = useModal();
  const { user } = useContext(AuthContext);

  const [episodeDetails, setEpisodeDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [watchOptionsMedia, setWatchOptionsMedia] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [showRes, epRes] = await Promise.all([
          api.get(`/media/tv/${tmdbId}`),
          api.get(`/media/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`)
        ]);
        setShowDetails(showRes.data);
        setEpisodeDetails(epRes.data);
      } catch (error) {
        console.error('Failed to load episode details:', error);
        showAlert('Failed to load episode details.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [tmdbId, seasonNumber, episodeNumber, showAlert]);

  const handleToggleWatched = () => {
    if (!episodeDetails || !showDetails) return;
    setWatchOptionsMedia({
      tmdbId: showDetails.id,
      type: 'episode',
      title: `Ep ${episodeNumber}. ${episodeDetails.name}`,
      overview: episodeDetails.overview,
      releaseDate: episodeDetails.air_date,
      posterPath: episodeDetails.still_path,
      season: parseInt(seasonNumber),
      episode: parseInt(episodeNumber),
      grandparentTitle: showDetails.name,
      parentTitle: `Season ${seasonNumber}`,
      isWatched: episodeDetails.isWatched
    });
    setIsWatchOptionsOpen(true);
  };

  const handleWatchOptionsSelect = async (choice, watchedAt = null, addSequentially = false) => {
    setIsWatchOptionsOpen(false);
    if (!episodeDetails || !showDetails) return;

    try {
      if (choice === 'watching-now') {
        await api.post('/media/active-session', {
          tmdbId: showDetails.id,
          type: 'episode',
          title: episodeDetails.name,
          overview: episodeDetails.overview,
          releaseDate: episodeDetails.air_date,
          posterPath: episodeDetails.still_path,
          season: parseInt(seasonNumber),
          episode: parseInt(episodeNumber),
          grandparentTitle: showDetails.name,
          parentTitle: `Season ${seasonNumber}`
        });
        showAlert('Started watching now', 'info');
      } else if (choice === 'removed-last') {
        setEpisodeDetails(prev => ({ ...prev, isWatched: false }));
        showAlert('Removed watch entry', 'info');
      } else {
        await api.post('/media/episode/watch', {
          tmdbId: showDetails.id,
          season: parseInt(seasonNumber),
          episode: parseInt(episodeNumber),
          watched: true,
          title: showDetails.name,
          posterPath: showDetails.poster_path,
          watchedAt,
          choice
        });
        setEpisodeDetails(prev => ({ ...prev, isWatched: true }));
        showAlert('Marked as watched', 'success');
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
      showAlert('Failed to update watch status', 'error');
    }
  };

  const handleToggleCollected = async () => {
    if (!episodeDetails) return;
    try {
      const newCollectedStatus = !episodeDetails.isCollected;
      await api.post('/media/episode/collect', {
        tmdbId: parseInt(tmdbId),
        season: parseInt(seasonNumber),
        episode: parseInt(episodeNumber),
        collected: newCollectedStatus,
        title: showDetails?.name || 'Unknown Show',
        posterPath: showDetails?.poster_path || null
      });
      setEpisodeDetails(prev => ({
        ...prev,
        isCollected: newCollectedStatus
      }));
    } catch (error) {
      console.error('Failed to toggle collected status', error);
      showAlert('Failed to update collected status.');
    }
  };

  // Update state to use a fixed scroll handler
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!episodeDetails) {
    return (
      <div className="page-container">
        <div className="content-container">
          <p style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>Episode not found.</p>
        </div>
      </div>
    );
  }

  const {
    name,
    overview,
    air_date,
    runtime,
    still_path,
    vote_average,
    guest_stars,
    crew,
    isWatched,
    isCollected,
    localFile
  } = episodeDetails;

  const backdropUrl = still_path 
    ? `https://image.tmdb.org/t/p/w1280${still_path}` 
    : (showDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${showDetails.backdrop_path}` : '');
  const posterUrl = still_path 
    ? `https://image.tmdb.org/t/p/w500${still_path}` 
    : (showDetails?.poster_path ? `https://image.tmdb.org/t/p/w500${showDetails.poster_path}` : '');

  const directors = crew?.filter(c => c.job === 'Director') || [];
  const writers = crew?.filter(c => c.department === 'Writing' || c.job === 'Writer') || [];

  return (
    <div className="media-details-page">
      {/* Backdrop Area */}
      <div className="details-backdrop-bg">
        <div
          className="details-backdrop-image"
          style={{
            backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none',
            filter: `blur(${Math.min(10, scrollY / 30)}px)`,
            transform: `scale(${1 + Math.min(10, scrollY / 30) / 100})`
          }}
        />
        <div
          className="details-backdrop-overlay"
          style={{
            opacity: Math.min(0.8, scrollY / 250)
          }}
        />
        <div className="details-backdrop-gradient" />
      </div>

      <div className="details-banner-spacer">
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'var(--bg-card)' }}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
      </div>

      {/* Content Layout */}
      <div className="details-content-wrapper">
        <div className="details-layout">

          {/* Left Column: Poster */}
          <div className="details-left-col">
            <div className="details-poster-container" style={{ cursor: 'default' }}>
              <div className="details-poster-card">
                {posterUrl ? (
                  <img src={posterUrl} alt={name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '330px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No Image
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata, Summary, Cast */}
          <div className="details-right-col">
            <div>
              <Link to={`/shows/${tmdbId}`} style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: '600', marginBottom: '8px', display: 'inline-block' }}>
                {showDetails?.name}
              </Link>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', lineHeight: '1.2' }}>
                {name}
              </h1>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: '400' }}>
                Season {seasonNumber}, Episode {episodeNumber}
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
                {vote_average > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                    <Star size={18} fill="#fbbf24" />
                    <span style={{ fontWeight: '600', fontSize: '1rem' }}>{vote_average.toFixed(1)}</span>
                  </div>
                )}

                {runtime > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <Clock size={16} />
                    <span>{runtime} min</span>
                  </div>
                )}

                {air_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <Calendar size={16} />
                    <span>{new Date(air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>

                <button
                  className="btn"
                  style={{
                    background: isCollected ? 'rgba(59, 130, 246, 0.15)' : 'var(--overlay-subtle)',
                    color: isCollected ? '#60a5fa' : 'var(--text-main)',
                    border: isCollected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                    fontWeight: '600'
                  }}
                  onClick={handleToggleCollected}
                >
                  <Plus size={18} style={{ transform: isCollected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                  <span>{isCollected ? 'Collected' : 'Collect'}</span>
                </button>

                <button
                  className="btn"
                  style={{
                    background: isWatched ? 'rgba(16, 185, 129, 0.15)' : 'var(--overlay-subtle)',
                    color: isWatched ? 'var(--success)' : 'var(--text-main)',
                    border: isWatched ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    fontWeight: '600'
                  }}
                  onClick={handleToggleWatched}
                >
                  {isWatched ? <Check size={18} /> : <Eye size={18} />}
                  <span>{isWatched ? 'Watched' : 'Watch'}</span>
                </button>

                {!localFile && (
                   <RequestButton 
                     tmdbId={showDetails?.id} 
                     type="tv" 
                     title={showDetails?.name} 
                     season={seasonNumber}
                     episode={episodeNumber}
                   />
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <ReactionPicker mediaId={showDetails?.id} mediaType="tv" season={seasonNumber} episode={episodeNumber} />
              </div>

              {/* Overview */}
              {overview && (
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '12px' }}>Overview</h3>
                  <p style={{ lineHeight: '1.6', color: 'var(--text-muted)' }}>{overview}</p>
                </div>
              )}

              {/* Crew */}
              {(directors.length > 0 || writers.length > 0) && (
                <div style={{ marginBottom: '32px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                  {directors.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '8px' }}>Director{directors.length > 1 ? 's' : ''}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {directors.map(d => (
                          <Link key={d.id} to={`/person/${d.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                            {d.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {writers.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '8px' }}>Writer{writers.length > 1 ? 's' : ''}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {writers.map(w => (
                          <Link key={w.id} to={`/person/${w.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                            {w.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Guest Cast */}
              {guest_stars && guest_stars.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  {/* Cast Section */}
                  <MediaCast cast={episodeDetails.guest_stars} title="Guest Stars" />
                </div>
              )}

              <CommentSection mediaId={showDetails?.id} mediaType="tv" season={seasonNumber} episode={episodeNumber} />

            </div>
          </div>
        </div>
      </div>

      {isWatchOptionsOpen && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={watchOptionsMedia}
          onSelect={handleWatchOptionsSelect}
          onWatchStatusChange={(newIsWatched) => {
            setEpisodeDetails(prev => ({ ...prev, isWatched: newIsWatched }));
          }}
        />
      )}
    </div>
  );
};

export default EpisodeDetails;

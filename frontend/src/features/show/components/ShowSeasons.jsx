import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ExternalLink, History, RefreshCw, Calendar, Plus, Check, Eye, X } from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import WatchOptionsModal from '../../../components/WatchOptionsModal';
import { useShowStore } from '../store/useShowStore';
import { useModal } from '../../../context/ModalContext';
import api from '../../../api';

const ShowSeasons = () => {
  const { showAlert } = useModal();
  const navigate = useNavigate();

  const [activeEpisodeMenu, setActiveEpisodeMenu] = useState(null);
  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [watchOptionsMedia, setWatchOptionsMedia] = useState(null);
  const [showSeasonRawModal, setShowSeasonRawModal] = useState(false);
  const [rawEpisode, setRawEpisode] = useState(null);
  const [activeWatchEpisode, setActiveWatchEpisode] = useState(null);

  const {
    showDetails,
    setShowDetails,
    activeSeason,
    seasonEpisodes,
    loadingSeason,
    isSeasonDropdownOpen,
    setIsSeasonDropdownOpen,
    expandedEpisodes,
    toggleEpisodeExpand,
    handleSelectSeason,
    rawData,
    fetchRawData,
    loadingRaw,
    modalError,
    setModalError,
    setShowRawModal,
    setCorrectingFiles,
    setCorrectTitle,
    setCorrectMode,
    setCorrectYear,
    setCorrectId
  } = useShowStore();

  const tmdbId = showDetails?.id;

  const handleScanSeason = async () => {
    if (!activeSeason) return;
    try {
      showAlert(`Scanning folders for Season ${activeSeason}...`, 'info');
      const res = await api.post(`/media/scan/tv/${tmdbId}?season=${activeSeason}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        const detailsRes = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(detailsRes.data);
        handleSelectSeason(tmdbId, activeSeason);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleScanEpisode = async (episodeNumber) => {
    if (!activeSeason) return;
    try {
      showAlert(`Scanning folders for Season ${activeSeason} Episode ${episodeNumber}...`, 'info');
      const res = await api.post(`/media/scan/tv/${tmdbId}?season=${activeSeason}&episode=${episodeNumber}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        const detailsRes = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(detailsRes.data);
        handleSelectSeason(tmdbId, activeSeason);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleEpisodeToggle = async (action, episode) => {
    const isWatched = action === 'watch';
    const currentVal = isWatched ? episode.isWatched : episode.isCollected;
    const newVal = !currentVal;

    if (isWatched) {
      setActiveWatchEpisode(episode);
      setWatchOptionsMedia({
        tmdbId: showDetails.id,
        type: 'episode',
        title: `Ep ${episode.episode_number}. ${episode.name}`,
        overview: episode.overview,
        releaseDate: episode.air_date || episode.airDateTime,
        posterPath: episode.still_path,
        season: episode.season_number,
        episode: episode.episode_number,
        grandparentTitle: showDetails.name,
        parentTitle: `Season ${episode.season_number}`,
        isWatched: episode.isWatched
      });
      setIsWatchOptionsOpen(true);
      return;
    }

    try {
      await api.post(`/media/episode/${action}`, {
        tmdbId: showDetails.id,
        season: episode.season_number,
        episode: episode.episode_number,
        [isWatched ? 'watched' : 'collected']: newVal,
        title: showDetails.name,
        overview: episode.overview,
        releaseDate: episode.air_date || episode.airDateTime,
        posterPath: episode.still_path
      });
      handleSelectSeason(tmdbId, activeSeason);
    } catch (err) {
      console.error(`Failed to ${action} episode:`, err);
    }
  };

  const handleWatchOptionsSelect = async ({ choice, watchedAt, addSequentially }) => {
    if (!showDetails) return;

    if (watchOptionsMedia?.type === 'season') {
      try {
        await api.post('/media/tv/watch-bulk', {
          tmdbId: showDetails.id,
          type: watchOptionsMedia.type,
          season: watchOptionsMedia.season,
          title: showDetails.name,
          posterPath: showDetails.poster_path,
          watched: true,
          watchedAt,
          choice,
          addSequentially
        });
        showAlert(`Marked season as watched`, 'success');
        handleSelectSeason(tmdbId, activeSeason);
      } catch (err) {
        console.error('Failed to log bulk watch:', err);
        showAlert('Failed to update watch status', 'error');
      }
    } else if (watchOptionsMedia?.type === 'episode') {
      try {
        await api.post('/media/episode/watch', {
          tmdbId: watchOptionsMedia.tmdbId,
          season: watchOptionsMedia.season,
          episode: watchOptionsMedia.episode,
          watched: true,
          watchedAt,
          title: showDetails.name,
          overview: watchOptionsMedia.overview,
          releaseDate: watchOptionsMedia.releaseDate,
          posterPath: watchOptionsMedia.posterPath
        });
        handleSelectSeason(tmdbId, activeSeason);
      } catch (err) {
        console.error('Failed to mark episode as watched:', err);
        showAlert('Failed to mark episode as watched', 'error');
      }
    }
  };

  const startFileReMatch = (file) => {
    setShowSeasonRawModal(false);
    setRawEpisode(null);
    setCorrectingFiles([file]);
    
    // Parse title for correct box
    const parts = file.path.split(/[/\\]/).filter(Boolean);
    let targetName = parts.pop() || '';
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!parts[i].toLowerCase().includes('season') && !parts[i].toLowerCase().match(/specials?/i)) {
        targetName = parts[i];
        break;
      }
    }
    const tmdbMatch = targetName.match(/\{tmdb-(\d+)\}/i);
    let tmdbIdMatch = '';
    if (tmdbMatch) {
      tmdbIdMatch = tmdbMatch[1];
      targetName = targetName.replace(tmdbMatch[0], '').trim();
    }
    const yearMatch = targetName.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
    let year = '';
    let title = targetName;
    if (yearMatch) {
      year = yearMatch[1];
      title = targetName.substring(0, targetName.indexOf(yearMatch[0]));
    }
    const cleanTitleStr = title.replace(/[._-]/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|uhd|bluray|brrip|bdrip|dvdrip|webrip|web-dl|h264|x264|h265|x265|hevc|dd5\s*1|aac|dts|remux|xvid|divx)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    setCorrectTitle(cleanTitleStr);
    const showYear = showDetails?.first_air_date ? showDetails.first_air_date.substring(0, 4) : '';
    setCorrectYear(year && showYear && year !== showYear ? '' : year);
    setCorrectId(tmdbIdMatch || '');
    setCorrectMode(true);
    setShowRawModal(true);
  };

  return (
    <>
{/* Seasons Selection row */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Seasons</h3>
                    {activeSeason && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="info-dropdown-container season-dropdown-container">
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '1rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', minWidth: '0', height: 'auto', border: '1px solid var(--border-color)' }}
                            onClick={() => setIsSeasonDropdownOpen(prev => !prev)}
                            title="Season options"
                          >
                            ...
                          </button>
                          {isSeasonDropdownOpen && (
                            <>
                              {/* Desktop Dropdown Menu */}
                              <div className="info-dropdown-menu" style={{ right: 0, left: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    handleScanSeason();
                                  }}
                                >
                                  <Search size={12} /> Scan Season for Media
                                </button>
                                <a
                                  href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${activeSeason}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="info-dropdown-item"
                                  onClick={() => setIsSeasonDropdownOpen(false)}
                                >
                                  <ExternalLink size={12} /> View Season on TMDb
                                </a>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setWatchOptionsMedia({
                                      type: 'season',
                                      season: activeSeason,
                                      tmdbId: showDetails.id,
                                      title: `Season ${activeSeason}`
                                    });
                                    setIsWatchOptionsOpen(true);
                                  }}
                                >
                                  <History size={16} /> Mark Season as Watched
                                </button>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setShowSeasonRawModal(true);
                                    fetchRawData();
                                  }}
                                >
                                  <RefreshCw size={12} /> View Season Local Data
                                </button>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    navigate(`/history?type=tv&season=${activeSeason}&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                                  }}
                                >
                                  <History size={12} /> View Season Watch History
                                </button>
                              </div>

                              {/* Mobile Bottom Sheet Menu */}
                              <MobileBottomSheet title={`Season ${activeSeason} Options`} onClose={() => setIsSeasonDropdownOpen(false)}>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setWatchOptionsMedia({
                                      type: 'season',
                                      season: activeSeason,
                                      tmdbId: showDetails.id,
                                      title: `Season ${activeSeason}`
                                    });
                                    setIsWatchOptionsOpen(true);
                                  }}
                                >
                                  <div className="icon-wrapper" style={{ color: 'var(--accent)', background: 'rgba(59, 130, 246, 0.15)' }}>
                                    <History size={18} />
                                  </div>
                                  <div className="text-wrapper">
                                    <span className="title">Mark Season as Watched</span>
                                    <span className="subtitle">Mark all season episodes as watched</span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    handleScanSeason();
                                  }}
                                >
                                  <Search size={16} /> Scan Season for Media
                                </button>
                                <a
                                  href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${activeSeason}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mobile-sheet-option"
                                  onClick={() => setIsSeasonDropdownOpen(false)}
                                >
                                  <ExternalLink size={16} /> View Season on TMDb
                                </a>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setShowSeasonRawModal(true);
                                    fetchRawData();
                                  }}
                                >
                                  <RefreshCw size={16} /> View Season Local Data
                                </button>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    navigate(`/history?type=tv&season=${activeSeason}&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                                  }}
                                >
                                  <History size={16} /> View Season Watch History
                                </button>
                              </MobileBottomSheet>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    className="seasons-scroll-container"
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '12px',
                      marginBottom: '8px',
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  >
                    {showDetails.seasons?.filter(s => s.season_number > 0).map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSeason(tmdbId, s.season_number)}
                        className="btn"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          borderRadius: '20px',
                          background: activeSeason === s.season_number ? 'var(--accent)' : 'var(--overlay-subtle)',
                          color: activeSeason === s.season_number ? '#fff' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          border: activeSeason === s.season_number ? 'none' : '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                      >
                        Season {s.season_number} ({s.episode_count} Ep)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Episodes List */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px' }}>Season {activeSeason} Episodes</h3>

                  {loadingSeason ? (
                    <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                    </div>
                  ) : seasonEpisodes.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No episodes found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {seasonEpisodes.map(ep => (
                        <div
                          key={ep.id}
                          id={`episode-${ep.episode_number}`}
                          className={`episode-card ${ep.isWatched ? 'is-watched' : ''}`}
                        >
                          {/* Episode Thumbnail */}
                          <div className="episode-thumbnail">
                            <Link to={`/shows/${tmdbId}/season/${activeSeason}/episode/${ep.episode_number}`}>
                              {ep.still_path ? (
                                <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={ep.name} loading="lazy" />
                              ) : (
                                <div className="episode-thumbnail-fallback">
                                  <span>No Image</span>
                                </div>
                              )}
                            </Link>
                          </div>

                          <div className="episode-card-body">
                            <div className="episode-card-header">
                              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                                <Link to={`/shows/${tmdbId}/season/${activeSeason}/episode/${ep.episode_number}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                  Ep {ep.episode_number}. {ep.name}
                                </Link>
                              </h4>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {ep.airDateTime ? (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }} title={`UTC: ${ep.airDateTime}`}>
                                    <Calendar size={12} />
                                    <span>{new Date(ep.airDateTime).toLocaleDateString()} at {new Date(ep.airDateTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                  </span>
                                ) : ep.air_date ? (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} />
                                    <span>{new Date(ep.air_date).toLocaleDateString()}</span>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p
                              className={`episode-description-text ${!expandedEpisodes[ep.id] ? 'collapsed' : ''}`}
                              onClick={() => toggleEpisodeExpand(ep.id)}
                              title="Click to expand/collapse"
                            >
                              {ep.overview || 'No description available for this episode.'}
                            </p>
                          </div>

                          {/* Quick toggles */}
                          <div className="episode-button-group">
                            <button
                              onClick={() => handleEpisodeToggle('collect', ep)}
                              className="btn btn-secondary"
                              style={{
                                background: ep.isCollected ? 'rgba(59, 130, 246, 0.2)' : 'var(--overlay-subtle)',
                                color: ep.isCollected ? '#60a5fa' : 'var(--text-muted)',
                                border: ep.isCollected ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent'
                              }}
                              title={ep.isCollected ? "Remove collected" : "Add to collection"}
                            >
                              <Plus size={16} style={{ transform: ep.isCollected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                              <span>{ep.isCollected ? 'Collected' : 'Collect'}</span>
                            </button>

                            <button
                              onClick={() => handleEpisodeToggle('watch', ep)}
                              className="btn btn-secondary"
                              style={{
                                background: ep.isWatched ? 'rgba(16, 185, 129, 0.2)' : 'var(--overlay-subtle)',
                                color: ep.isWatched ? 'var(--success)' : 'var(--text-muted)',
                                border: ep.isWatched ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent'
                              }}
                              title={ep.isWatched ? "Watched" : "Watch"}
                            >
                              {ep.isWatched ? <Check size={16} /> : <Eye size={16} />}
                              <span>{ep.isWatched ? 'Watched' : 'Watch'}</span>
                            </button>

                            <div className="episode-dropdown-container">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEpisodeMenu(activeEpisodeMenu === ep.id ? null : ep.id);
                                }}
                                className="btn btn-secondary episode-menu-btn"
                                title="More options"
                              >
                                ...
                              </button>

                              {activeEpisodeMenu === ep.id && (
                                <>
                                  {/* Desktop Dropdown Menu */}
                                  <div className="episode-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    {showDetails.external_ids?.imdb_id && (
                                      <a
                                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="episode-dropdown-item"
                                        onClick={() => setActiveEpisodeMenu(null)}
                                      >
                                        <ExternalLink size={14} /> IMDb
                                      </a>
                                    )}
                                    <a
                                      href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${ep.season_number}/episode/${ep.episode_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="episode-dropdown-item"
                                      onClick={() => setActiveEpisodeMenu(null)}
                                    >
                                      <ExternalLink size={14} /> TMDb
                                    </a>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        handleScanEpisode(ep.episode_number);
                                      }}
                                    >
                                      <Search size={14} /> Scan for Media
                                    </button>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        setRawEpisode(ep);
                                        fetchRawData();
                                      }}
                                    >
                                      <RefreshCw size={14} /> View Local Data
                                    </button>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        navigate(`/history?type=tv&season=${ep.season_number}&episode=${ep.episode_number}&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                                      }}
                                    >
                                      <History size={14} /> View Watch History
                                    </button>
                                  </div>

                                  {/* Mobile Bottom Sheet Menu */}
                                  <MobileBottomSheet title="Episode Options" onClose={() => setActiveEpisodeMenu(null)}>
                                    {showDetails.external_ids?.imdb_id && (
                                      <a
                                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mobile-sheet-option"
                                        onClick={() => setActiveEpisodeMenu(null)}
                                      >
                                        <ExternalLink size={16} /> View on IMDb
                                      </a>
                                    )}
                                    <a
                                      href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${ep.season_number}/episode/${ep.episode_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mobile-sheet-option"
                                      onClick={() => setActiveEpisodeMenu(null)}
                                    >
                                      <ExternalLink size={16} /> View on TMDb
                                    </a>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        handleScanEpisode(ep.episode_number);
                                      }}
                                    >
                                      <Search size={16} /> Scan for Media
                                    </button>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        setRawEpisode(ep);
                                        fetchRawData();
                                      }}
                                    >
                                      <RefreshCw size={16} /> View Local Data
                                    </button>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        navigate(`/history?type=tv&season=${ep.season_number}&episode=${ep.episode_number}&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                                      }}
                                    >
                                      <History size={16} /> View Watch History
                                    </button>
                                  </MobileBottomSheet>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

      {showSeasonRawModal && (
        <div className="custom-modal-backdrop" onClick={() => { setShowSeasonRawModal(false); setModalError(''); }}>
          <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontWeight: '700' }}>Season {activeSeason} Local Data</h3>
              <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setShowSeasonRawModal(false); setModalError(''); }}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body">
              {loadingRaw ? (
                <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                  <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching database records...</span>
                </div>
              ) : modalError ? (
                <div style={{ color: 'var(--danger)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                  {modalError}
                </div>
              ) : (
                <>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Season {activeSeason} Local File Paths</h4>
                    {rawData?.files && rawData.files.filter(f => f.season === activeSeason).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rawData.files.filter(f => f.season === activeSeason).map(f => (
                          <div key={f.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--overlay-subtle)' }}>
                            <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>
                              S{String(f.season).padStart(2, '0')}E{String(f.episode).padStart(2, '0')} - {f.path}
                            </code>
                            <button
                              onClick={() => startFileReMatch(f)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '1rem', flexShrink: 0 }}
                            >
                              Re-match Path
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--overlay-subtle)', borderRadius: '6px' }}>
                        No local files detected for Season {activeSeason} in the database.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="custom-modal-footer">
              <button className="btn btn-primary" onClick={() => setShowSeasonRawModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {rawEpisode && (
        <div className="custom-modal-backdrop" onClick={() => { setRawEpisode(null); setModalError(''); }}>
          <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontWeight: '700' }}>
                S{String(rawEpisode.season_number).padStart(2, '0')}E{String(rawEpisode.episode_number).padStart(2, '0')} Local Data
              </h3>
              <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setRawEpisode(null); setModalError(''); }}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body">
              {loadingRaw ? (
                <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                  <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching database records...</span>
                </div>
              ) : modalError ? (
                <div style={{ color: 'var(--danger)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                  {modalError}
                </div>
              ) : (
                <>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Local File Paths</h4>
                    {rawData?.files && rawData.files.filter(f => f.season === rawEpisode.season_number && f.episode === rawEpisode.episode_number).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rawData.files.filter(f => f.season === rawEpisode.season_number && f.episode === rawEpisode.episode_number).map(f => (
                          <div key={f.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--overlay-subtle)' }}>
                            <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>
                              {f.path}
                            </code>
                            <button
                              onClick={() => startFileReMatch(f)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '1rem', flexShrink: 0 }}
                            >
                              Re-match Path
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--overlay-subtle)', borderRadius: '6px' }}>
                        No local files detected for this episode in the database.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="custom-modal-footer">
              <button className="btn btn-primary" onClick={() => setRawEpisode(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isWatchOptionsOpen && watchOptionsMedia && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={watchOptionsMedia}
          onSelect={handleWatchOptionsSelect}
        />
      )}
    </>
  );
};

export default ShowSeasons;

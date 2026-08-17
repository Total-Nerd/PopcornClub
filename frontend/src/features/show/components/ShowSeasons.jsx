import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ExternalLink, History, RefreshCw, Calendar, Plus, Check, Eye } from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import { useShowStore } from '../store/useShowStore';

const ShowSeasons = ({
  handleScanSeason,
  handleScanEpisode,
  handleEpisodeToggle,
  setWatchOptionsMedia,
  setIsWatchOptionsOpen,
  setShowSeasonRawModal,
  fetchRawData,
  setRawEpisode,
  activeEpisodeMenu,
  setActiveEpisodeMenu
}) => {
  const {
    showDetails,
    activeSeason,
    seasonEpisodes,
    loadingSeason,
    isSeasonDropdownOpen,
    setIsSeasonDropdownOpen,
    expandedEpisodes,
    toggleEpisodeExpand,
    handleSelectSeason
  } = useShowStore();

  const navigate = useNavigate();
  const tmdbId = showDetails?.id;

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
    </>
  );
};

export default ShowSeasons;

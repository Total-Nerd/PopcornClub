import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Edit, Star, Plus, ExternalLink, Search, RefreshCw, History } from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import RequestButton from '../../../components/RequestButton';
import ReactionPicker from '../../../components/ReactionPicker';

const ShowHeader = ({
  showDetails,
  scrollY,
  navigate,
  setImageSelectorType,
  setImageSelectorOpen,
  handleToggleCollection,
  isShowInAnyList,
  setIsListDropdownOpen,
  isListDropdownOpen,
  lists,
  listMemberships,
  handleToggleList,
  setIsDropdownOpen,
  isDropdownOpen,
  setWatchOptionsMedia,
  setIsWatchOptionsOpen,
  handleScanShow,
  setShowRawModal,
  fetchRawData
}) => {
  return (
    <>
{/* Backdrop Area */}
          <div className="details-backdrop-bg">
            <div
              className="details-backdrop-image"
              style={{
                backgroundImage: showDetails.backdrop_path ? `url(https://image.tmdb.org/t/p/w1280${showDetails.backdrop_path})` : 'none',
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

            <button
              className="edit-backdrop-btn"
              onClick={() => {
                setImageSelectorType('backdrop');
                setImageSelectorOpen(true);
              }}
            >
              <Edit size={16} />
              <span>Change Backdrop</span>
            </button>
          </div>

          {/* Content Layout */}
          <div className="details-content-wrapper">
            <div className="details-layout">

              {/* Left Column: Poster */}
              <div className="details-left-col">
                <div
                  className="details-poster-container"
                  onClick={() => {
                    setImageSelectorType('poster');
                    setImageSelectorOpen(true);
                  }}
                >
                  <div className="details-poster-card">
                    {showDetails.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${showDetails.poster_path}`} alt={showDetails.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '330px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        No Cover
                      </div>
                    )}
                  </div>
                  <div className="details-poster-edit-overlay">
                    <Edit size={24} />
                    <span>Change Poster</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata, Summary, Cast, Seasons */}
              <div className="details-right-col">
                <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', lineHeight: '1.2' }}>{showDetails.name}</h1>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                      <Star size={18} fill="#fbbf24" />
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{showDetails.vote_average?.toFixed(1) || '0.0'}</span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {showDetails.number_of_seasons} Seasons • {showDetails.number_of_episodes} Episodes
                    </div>

                    {showDetails.first_air_date && (
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        First Aired: {new Date(showDetails.first_air_date).getFullYear()}
                      </div>
                    )}
                  </div>

                  {/* Genres */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    {showDetails.genres?.map(g => (
                      <span key={g.id} style={{ padding: '6px 14px', background: 'var(--overlay-subtle)', borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                        {g.name}
                      </span>
                    ))}
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <ReactionPicker mediaId={showDetails.id} mediaType="tv" />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!showDetails.isCollected && (
                      <button
                        className="btn"
                        style={{
                          background: 'var(--accent)',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                        onClick={handleToggleCollection}
                      >
                        <Plus size={18} />
                        <span>Add to Collection</span>
                      </button>
                    )}

                    <div className="info-dropdown-container show-dropdown-container">
                      <button
                        className="btn btn-secondary"
                        style={{
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: isShowInAnyList() ? 'rgba(59, 130, 246, 0.15)' : 'var(--overlay-subtle)',
                          color: isShowInAnyList() ? 'rgb(96, 165, 250)' : 'var(--text-main)',
                          border: isShowInAnyList() ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsListDropdownOpen(prev => !prev);
                        }}
                      >
                        <Plus size={18} />
                        <span>{isShowInAnyList() ? 'Added to List' : 'Add to List'}</span>
                      </button>

                      {isListDropdownOpen && (
                        <>
                          <div className="info-dropdown-menu" onClick={e => e.stopPropagation()}>
                            {lists.map(list => {
                              const inList = listMemberships[list.id];
                              return (
                                <label key={list.id} className="info-dropdown-item" style={{ cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!inList}
                                    onChange={() => handleToggleList(list.id)}
                                  />
                                  {list.name}
                                </label>
                              );
                            })}
                          </div>
                          <MobileBottomSheet title="Add to List" onClose={() => setIsListDropdownOpen(false)}>
                            {lists.map(list => {
                              const inList = listMemberships[list.id];
                              return (
                                <label key={list.id} className="mobile-sheet-option" style={{ cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!inList}
                                    onChange={() => handleToggleList(list.id)}
                                    style={{ transform: 'scale(1.2)' }}
                                  />
                                  {list.name}
                                </label>
                              );
                            })}
                          </MobileBottomSheet>
                        </>
                      )}
                    </div>

                    {showDetails.external_ids?.imdb_id && (
                      <a
                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{
                          background: '#f5c518',
                          color: '#000000',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        IMDb <ExternalLink size={16} style={{ marginLeft: '6px' }} />
                      </a>
                    )}
                    <a
                      href={`https://www.themoviedb.org/tv/${showDetails.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{
                        background: '#01b4e4',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      TMDb <ExternalLink size={16} style={{ marginLeft: '6px' }} />
                    </a>

                    {(showDetails.collectedEpisodes?.length || 0) < (showDetails.number_of_episodes || 0) && (
                       <RequestButton 
                         tmdbId={showDetails.id} 
                         type="tv" 
                         title={showDetails.name} 
                       />
                    )}

                    <div className="info-dropdown-container show-dropdown-container">
                      <button
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', height: '100%' }}
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        title="More actions"
                      >
                        ...
                      </button>
                      {isDropdownOpen && (
                        <>
                          {/* Desktop Dropdown Menu */}
                          <div className="info-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setWatchOptionsMedia({
                                  type: 'show',
                                  tmdbId: showDetails.id,
                                  title: showDetails.name,
                                  releaseDate: showDetails.first_air_date
                                });
                                setIsWatchOptionsOpen(true);
                              }}
                            >
                              <History size={16} /> Mark Show as Watched
                            </button>
                            <button
                              type="button"
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                handleScanShow();
                              }}
                            >
                              <Search size={14} /> Scan for Media
                            </button>
                            <button
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setShowRawModal(true);
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={14} /> View Local Data
                            </button>
                            <button
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?type=tv&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                              }}
                            >
                              <History size={14} /> View Watch History
                            </button>
                          </div>

                          {/* Mobile Bottom Sheet Menu */}
                          <MobileBottomSheet title="Show Options" onClose={() => setIsDropdownOpen(false)}>
                            <button
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setWatchOptionsMedia({
                                  type: 'show',
                                  tmdbId: showDetails.id,
                                  title: showDetails.name,
                                  releaseDate: showDetails.first_air_date
                                });
                                setIsWatchOptionsOpen(true);
                              }}
                            >
                              <div className="icon-wrapper" style={{ color: 'var(--accent)', background: 'rgba(59, 130, 246, 0.15)' }}>
                                <History size={18} />
                              </div>
                              <div className="text-wrapper">
                                <span className="title">Mark Show as Watched</span>
                                <span className="subtitle">Mark all episodes as watched</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                handleScanShow();
                              }}
                            >
                              <Search size={16} /> Scan for Media
                            </button>
                            <button
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                setShowRawModal(true);
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={16} /> View Local Data
                            </button>
                            <button
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?type=tv&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
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
    </>
  );
};

export default ShowHeader;

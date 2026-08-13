import { AuthContext } from '../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Sliders, LayoutGrid, List as ListIcon } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import MobileBottomSheet from '../components/MobileBottomSheet';

const getContentWidth = (windowWidth) => {
  if (windowWidth > 768) {
    const isSidebarCollapsed = document.querySelector('.app-container')?.classList.contains('sidebar-collapsed');
    const sidebarWidth = isSidebarCollapsed ? 72 : 250;
    return windowWidth - sidebarWidth - 80;
  }
  return windowWidth - 32;
};

const getColsRange = (windowWidth, aspectRatio) => {
  const contentWidth = getContentWidth(windowWidth);
  const minSize = aspectRatio === 'landscape' ? 200 : 100;
  const maxSize = aspectRatio === 'landscape' ? 500 : 400;

  const getColsForSize = (size) => {
    const gap = size < 140 ? 12 : 24;
    return Math.max(1, Math.floor((contentWidth + gap) / (size + gap)));
  };

  const minCols = getColsForSize(maxSize);
  const maxCols = getColsForSize(minSize);

  return { min: minCols, max: Math.max(minCols + 1, maxCols) };
};

const getGridSizeFromCols = (cols, windowWidth, aspectRatio) => {
  const contentWidth = getContentWidth(windowWidth);
  const estimatedSize = contentWidth / cols;
  const gap = estimatedSize < 140 ? 12 : 24;

  const size = Math.floor((contentWidth - (cols - 1) * gap) / cols);
  const minLimit = aspectRatio === 'landscape' ? 200 : 100;
  const maxLimit = aspectRatio === 'landscape' ? 500 : 400;

  return Math.min(maxLimit, Math.max(minLimit, size));
};

const getDefaultCols = (aspectRatio) => {
  const targetSize = aspectRatio === 'landscape' ? 250 : 150;
  if (window.innerWidth > 768) {
    const contentWidth = window.innerWidth - 250 - 80;
    const gap = 24;
    return Math.max(1, Math.round((contentWidth + gap) / (targetSize + gap)));
  }
  return aspectRatio === 'landscape' ? 2 : 4;
};

const PersonDetails = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Display options
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('person_view_mode') || 'grid');
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('person_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('person_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('person_aspect_ratio') || 'portrait');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all'); // 'all', 'movie', 'tv'

  const colsRange = getColsRange(windowWidth, aspectRatio);
  const activeCols = aspectRatio === 'landscape'
    ? Math.min(colsRange.max, Math.max(colsRange.min, colsLandscape))
    : Math.min(colsRange.max, Math.max(colsRange.min, colsPortrait));
  const gridSize = getGridSizeFromCols(activeCols, windowWidth, aspectRatio);

  useEffect(() => {
    localStorage.setItem('person_view_mode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('person_cols_portrait', colsPortrait);
  }, [colsPortrait]);
  useEffect(() => {
    localStorage.setItem('person_cols_landscape', colsLandscape);
  }, [colsLandscape]);
  useEffect(() => {
    localStorage.setItem('person_aspect_ratio', aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClose = () => {
      setIsDisplayMenuOpen(false);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    const fetchPersonDetails = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/media/person/${personId}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch person details:', err);
        setError('Failed to retrieve person information.');
      } finally {
        setLoading(false);
      }
    };
    fetchPersonDetails();
  }, [personId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div className="spin" style={{ width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}></div>
        <span style={{ color: 'var(--text-muted)' }}>Loading person profile...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Error</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error || 'An unexpected error occurred.'}</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Go Back
        </button>
      </div>
    );
  }

  const { person, credits, collectedMedia } = data;

  // Filter global credits list based on mediaTypeFilter
  const creditsList = (credits?.cast || []).filter(item => {
    if (mediaTypeFilter === 'all') return true;
    return item.media_type === mediaTypeFilter;
  });

  // Sort by popularity and release date to show best/latest first
  const sortedCreditsList = [...creditsList].sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || '';
    const dateB = b.release_date || b.first_air_date || '';
    return dateB.localeCompare(dateA) || (b.vote_average - a.vote_average);
  });

  // Filter and normalize locally collected media
  const normalizedCollected = (collectedMedia || []).map(item => ({
    id: item.tmdbId,
    media_type: item.type,
    title: item.title,
    name: item.title,
    poster_path: item.posterPath,
    backdrop_path: item.backdropPath,
    release_date: item.releaseDate ? item.releaseDate.substring(0, 10) : '',
    first_air_date: item.releaseDate ? item.releaseDate.substring(0, 10) : '',
    character: '',
    isCollected: true
  })).filter(item => {
    if (mediaTypeFilter === 'all') return true;
    return item.media_type === mediaTypeFilter;
  });

  const renderDisplayOptionsContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Layout</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'grid' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'list' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <ListIcon size={14} /> List
            </button>
          </div>
        </div>

        {viewMode === 'grid' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              <span>Items per Row</span>
              {!isMobile && <span>{activeCols} ({gridSize}px)</span>}
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
                {aspectRatio === 'portrait' ? (
                  [1, 2, 3].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setColsPortrait(val)}
                      style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeCols === val ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {val}
                    </button>
                  ))
                ) : (
                  [1, 2].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setColsLandscape(val)}
                      style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: activeCols === val ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      {val}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="slider-active-container">
                <input
                  type="range"
                  min={colsRange.min}
                  max={colsRange.max}
                  step="1"
                  value={activeCols}
                  onMouseDown={() => setIsDraggingSlider(true)}
                  onTouchStart={() => setIsDraggingSlider(true)}
                  onMouseUp={() => setIsDraggingSlider(false)}
                  onTouchEnd={() => setIsDraggingSlider(false)}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    if (aspectRatio === 'landscape') {
                      setColsLandscape(val);
                    } else {
                      setColsPortrait(val);
                    }
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Aspect Ratio</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setAspectRatio('portrait')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: aspectRatio === 'portrait' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('landscape')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: aspectRatio === 'landscape' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Landscape
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Media Type</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            {['all', 'movie', 'tv'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setMediaTypeFilter(type)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none', background: mediaTypeFilter === type ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMovieGridCard = (item) => {
    const isMovie = item.media_type === 'movie';
    const isLandscape = aspectRatio === 'landscape';
    const imageUrl = isLandscape
      ? (item.backdrop_path ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` : null)
      : (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null);
    const itemYear = (item.release_date || item.first_air_date || '').substring(0, 4);

    return (
      <Link
        key={`${item.media_type}-${item.id}`}
        to={isMovie ? `/movies/${item.id}` : `/shows/${item.id}`}
        className="media-card"
        style={{ position: 'relative', overflow: 'hidden', aspectRatio: isLandscape ? '16/9' : 'auto' }}
      >
        {imageUrl ? (
          <LazyImage src={imageUrl} alt={item.title || item.name} style={{ aspectRatio: isLandscape ? '16/9' : '2/3', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: isLandscape ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
            {isLandscape ? 'No artwork' : 'No Poster'}
          </div>
        )}

        {isLandscape ? (
          <div className="media-card-content-overlay">
            <div className="media-title" style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
              {item.title || item.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="media-meta" style={{ fontSize: '0.75rem' }}>
                {itemYear || 'Unknown'} {item.character && ` • as ${item.character}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="media-card-content">
            <div className="media-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || item.name}</div>
            <div className="media-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {itemYear || 'Unknown'} {item.character && ` • as ${item.character}`}
            </div>
          </div>
        )}
      </Link>
    );
  };

  const renderMovieTable = (itemsList) => {
    return (
      <div style={{ overflowX: 'auto', marginTop: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Title</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Type</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Character</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Year</th>
            </tr>
          </thead>
          <tbody>
            {itemsList.map(item => {
              const isMovie = item.media_type === 'movie';
              const itemYear = (item.release_date || item.first_air_date || '').substring(0, 4);
              const targetUrl = isMovie ? `/movies/${item.id}` : `/shows/${item.id}`;

              return (
                <tr
                  key={`${item.media_type}-${item.id}`}
                  onClick={() => navigate(targetUrl)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 8px' }}>
                    <Link to={targetUrl} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'inherit', textDecoration: 'none' }}>
                    <div style={{
                      width: aspectRatio === 'landscape' ? '72px' : '36px',
                      height: aspectRatio === 'landscape' ? '40px' : '54px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.05)',
                      flexShrink: 0
                    }}>
                      {aspectRatio === 'landscape' ? (
                        item.backdrop_path ? (
                          <img src={`https://image.tmdb.org/t/p/w92${item.backdrop_path}`} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem', fontWeight: '600' }}>
                            No artwork
                          </div>
                        )
                      ) : (
                        item.poster_path ? (
                          <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                            No Poster
                          </div>
                        )
                      )}
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.title || item.name}</div>
                    </Link>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {item.character || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {itemYear || 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Top Bar with back link & Display Options */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Display options button */}
        <div className="display-options-container" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            className="btn btn-secondary display-options-btn"
            onClick={() => setIsDisplayMenuOpen(prev => !prev)}
          >
            <Sliders size={16} />
            <span className="display-options-text">Display Options</span>
          </button>

          {isDisplayMenuOpen && (
            isMobile ? (
              <MobileBottomSheet title="Display Options" onClose={() => setIsDisplayMenuOpen(false)} className={isDraggingSlider ? 'sheet-dragging-slider' : ''}>
                {renderDisplayOptionsContent()}
              </MobileBottomSheet>
            ) : (
              <div style={{
                position: 'absolute',
                top: '44px',
                right: 0,
                zIndex: 101,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                padding: '20px',
                minWidth: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backdropFilter: 'blur(8px)'
              }}>
                {renderDisplayOptionsContent()}
              </div>
            )
          )}
        </div>
      </div>

      {/* Profile Info Header */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '32px', padding: '24px', marginBottom: '40px' }}>
        <div style={{ width: isMobile ? '100%' : '240px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          {person.profile_path ? (
            <img
              src={`https://image.tmdb.org/t/p/h632${person.profile_path}`}
              alt={person.name}
              style={{ width: '100%', maxWidth: '240px', borderRadius: '12px', border: '1px solid var(--border-color)', objectFit: 'cover', aspectRatio: '2/3' }}
            />
          ) : (
            <div style={{ width: '240px', height: '360px', borderRadius: '12px', background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No Profile Image
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-main)' }}>{person.name}</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {person.known_for_department} 
              {person.birthday && ` • Born: ${person.birthday}`}
              {person.deathday && ` • Died: ${person.deathday}`}
              {person.place_of_birth && ` • in ${person.place_of_birth}`}
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>Biography</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem', margin: 0, maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
              {person.biography || 'No biography available.'}
            </p>
          </div>
        </div>
      </div>

      {/* In your collection element */}
      {normalizedCollected && normalizedCollected.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            In Your Collection ({normalizedCollected.length})
          </h3>
          {viewMode === 'grid' ? (
            <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
              {normalizedCollected.map(item => renderMovieGridCard(item))}
            </div>
          ) : (
            renderMovieTable(normalizedCollected)
          )}
        </div>
      )}

      {/* Filmography Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
            Filmography ({sortedCreditsList.length})
          </h3>
        </div>

        {/* Filmography content */}
        {sortedCreditsList.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0' }}>
            No media matching current type filters.
          </div>
        ) : viewMode === 'grid' ? (
          <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
            {sortedCreditsList.map(item => renderMovieGridCard(item))}
          </div>
        ) : (
          renderMovieTable(sortedCreditsList)
        )}
      </div>
    </div>
  );
};

export default PersonDetails;

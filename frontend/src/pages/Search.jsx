import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useNavigationType } from 'react-router-dom';
import { Search as SearchIcon, Plus, Eye, Check, EyeOff, Sliders, LayoutGrid, List as ListIcon } from 'lucide-react';
import api from '../api';
import { useModal } from '../context/ModalContext';
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

const Search = () => {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const urlQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(urlQuery || sessionStorage.getItem('search_query') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [lists, setLists] = useState([]);
  const [listMemberships, setListMemberships] = useState({}); // { [tmdbId]: { [listId]: { listItemId, mediaId } } }
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Display options states
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('search_view_mode') || 'grid');
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('search_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('search_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('search_aspect_ratio') || 'portrait');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const colsRange = getColsRange(windowWidth, aspectRatio);
  const activeCols = aspectRatio === 'landscape'
    ? Math.min(colsRange.max, Math.max(colsRange.min, colsLandscape))
    : Math.min(colsRange.max, Math.max(colsRange.min, colsPortrait));
  const gridSize = getGridSizeFromCols(activeCols, windowWidth, aspectRatio);

  useEffect(() => {
    localStorage.setItem('search_view_mode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('search_cols_portrait', colsPortrait);
  }, [colsPortrait]);
  useEffect(() => {
    localStorage.setItem('search_cols_landscape', colsLandscape);
  }, [colsLandscape]);
  useEffect(() => {
    localStorage.setItem('search_aspect_ratio', aspectRatio);
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

  const renderDisplayOptionsContent = (extraFilters = null) => {
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
              <LayoutGrid size={14} />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'list' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <ListIcon size={14} />
              List
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
                      {val} {val === 1 ? 'Item' : 'Items'}
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
                      {val} {val === 1 ? 'Item' : 'Items'}
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

        {extraFilters}
      </div>
    );
  };

  const renderDisplayOptions = (extraFilters = null) => {
    return (
      <div className="display-options-container" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIsDisplayMenuOpen(prev => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', fontWeight: '600' }}
        >
          <Sliders size={16} />
          <span>Display Options</span>
        </button>

        {isDisplayMenuOpen && (
          isMobile ? (
            <MobileBottomSheet title="Display Options" onClose={() => setIsDisplayMenuOpen(false)} className={isDraggingSlider ? 'sheet-dragging-slider' : ''}>
              {renderDisplayOptionsContent(extraFilters)}
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
              minWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backdropFilter: 'blur(8px)'
            }}>
              {renderDisplayOptionsContent(extraFilters)}
            </div>
          )
        )}
      </div>
    );
  };

  // Restore results from session storage if returning via back button
  useEffect(() => {
    if (navigationType === 'POP') {
      const savedResults = sessionStorage.getItem('search_results');
      const savedQuery = sessionStorage.getItem('search_query');
      if (savedResults) {
        setResults(JSON.parse(savedResults));
      }
      if (savedQuery) {
        setQuery(savedQuery);
      }
    } else {
      // Clear storage on new PUSH navigation
      sessionStorage.removeItem('search_scroll_pos');
      sessionStorage.removeItem('search_results');
      sessionStorage.removeItem('search_query');
    }
  }, [navigationType]);

  // Sync results to sessionStorage when they change
  useEffect(() => {
    if (results.length > 0) {
      sessionStorage.setItem('search_results', JSON.stringify(results));
    } else {
      sessionStorage.removeItem('search_results');
    }
  }, [results]);

  // Sync query to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('search_query', query);
  }, [query]);

  // Trigger search when urlQuery changes (e.g. from URL or back button)
  useEffect(() => {
    if (urlQuery) {
      setQuery(urlQuery);
      fetchSearchResults(urlQuery);
    }
  }, [urlQuery]);

  const fetchSearchResults = async (searchVal) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(searchVal)}`);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!query) return;
    setSearchParams({ q: query });
  };

  // Scroll restoration logic
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('search_scroll_pos', window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after results are rendered
  useEffect(() => {
    if (results.length > 0) {
      const savedScrollPos = sessionStorage.getItem('search_scroll_pos');
      if (savedScrollPos) {
        const timer = setTimeout(() => {
          window.scrollTo(0, parseInt(savedScrollPos, 10));
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [results]);

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);

      const memberships = {};
      for (const list of res.data) {
        for (const item of list.items) {
          if (!memberships[item.media.tmdbId]) {
            memberships[item.media.tmdbId] = {};
          }
          memberships[item.media.tmdbId][list.id] = { listItemId: item.id, mediaId: item.media.id };
        }
      }
      setListMemberships(memberships);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    const handleClose = () => setActiveDropdownId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const isItemInAnyList = (itemId) => {
    const memberships = listMemberships[itemId];
    return memberships && Object.keys(memberships).length > 0;
  };

  const handleToggleCollection = async (item) => {
    try {
      const isCurrent = item.isCollected;
      const payload = {
        tmdbId: item.id,
        type: item.media_type,
        title: item.title || item.name,
        overview: item.overview,
        releaseDate: item.release_date || item.first_air_date,
        posterPath: item.poster_path,
        remove: isCurrent
      };
      const res = await api.post('/media/collect', payload);

      setResults(prev => prev.map(r => {
        if (r.id === item.id) {
          return {
            ...r,
            isCollected: !r.isCollected,
            localId: res.data?.mediaId || r.localId
          };
        }
        return r;
      }));
    } catch (err) {
      showAlert(`Failed to toggle collection: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleToggleList = async (item, listId) => {
    try {
      const current = listMemberships[item.id]?.[listId];
      if (current) {
        const mediaId = current.mediaId || item.localId;
        if (!mediaId) {
          throw new Error('Media ID not resolved yet');
        }
        await api.delete(`/lists/${listId}/items/${mediaId}`);

        setListMemberships(prev => {
          const updated = { ...prev };
          if (updated[item.id]) {
            delete updated[item.id][listId];
          }
          return updated;
        });
      } else {
        const payload = {
          tmdbId: item.id,
          type: item.media_type,
          title: item.title || item.name,
          overview: item.overview,
          releaseDate: item.release_date || item.first_air_date,
          posterPath: item.poster_path
        };
        const res = await api.post(`/lists/${listId}/items`, payload);

        setListMemberships(prev => {
          const updated = { ...prev };
          if (!updated[item.id]) {
            updated[item.id] = {};
          }
          updated[item.id][listId] = { listItemId: res.data.id, mediaId: res.data.mediaId };
          return updated;
        });

        setResults(prev => prev.map(r => {
          if (r.id === item.id) {
            return { ...r, localId: res.data.mediaId };
          }
          return r;
        }));
      }
    } catch (err) {
      showAlert(`Failed to toggle list: ${err.response?.data?.error || err.message}`, 'error');
    }
  };



  const handleAction = async (action, item) => {
    try {
      const isCurrent = action === 'collect' ? item.isCollected : item.isWatched;
      const payload = {
        tmdbId: item.id,
        type: item.media_type,
        title: item.title || item.name,
        overview: item.overview,
        releaseDate: item.release_date || item.first_air_date,
        posterPath: item.poster_path,
        remove: isCurrent // if currently marked, clicking toggles it off
      };
      await api.post(`/media/${action}`, payload);

      // Update local state reactively so the UI reflects changes instantly
      setResults(prev => prev.map(r => {
        if (r.id === item.id) {
          return action === 'collect'
            ? { ...r, isCollected: !r.isCollected }
            : { ...r, isWatched: !r.isWatched };
        }
        return r;
      }));
    } catch (err) {
      showAlert(`Failed: ${err.response?.data?.error || 'Unknown error'}`, 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0 }}>Discover Media</h1>
        {renderDisplayOptions()}
      </div>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <input
          type="text"
          className="input-field"
          style={{ flex: 1 }}
          placeholder="Search for movies or TV shows..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <SearchIcon size={20} />
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</div>}

      {viewMode === 'grid' ? (
        <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
          {results.map(item => {
            const hasArtwork = aspectRatio === 'landscape' && item.backdrop_path;
            const imageUrl = hasArtwork
              ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
              : (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null);

            return (
              <div key={item.id} id={`search-item-${item.id}`} className="media-card" style={{ position: 'relative', overflow: 'hidden', aspectRatio: hasArtwork ? '16/9' : 'auto' }}>
                {imageUrl ? (
                  <LazyImage
                    src={imageUrl}
                    alt={item.title || item.name}
                    onClick={() => navigate(item.media_type === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`)}
                    style={{ cursor: 'pointer', aspectRatio: hasArtwork ? '16/9' : '2/3', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    onClick={() => navigate(item.media_type === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`)}
                    style={{ width: '100%', aspectRatio: hasArtwork ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    No Image
                  </div>
                )}

                {/* Overlapping status pills on card image */}
                <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  {item.isCollected && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.725rem',
                      fontWeight: '600',
                      background: 'rgba(59, 130, 246, 0.9)',
                      color: '#fff',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
                    }}>
                      Collected
                    </span>
                  )}
                  {item.isWatched && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.725rem',
                      fontWeight: '600',
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: '#fff',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
                    }}>
                      Watched
                    </span>
                  )}
                </div>

                {hasArtwork ? (
                  <div className="media-card-content-overlay" onClick={e => e.stopPropagation()}>
                    <div
                      className="media-title"
                      title={item.title || item.name}
                      onClick={() => navigate(item.media_type === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`)}
                      style={{ fontSize: '0.9rem', marginBottom: '2px', cursor: 'pointer' }}
                    >
                      {item.title || item.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div className="media-meta" style={{ fontSize: '0.75rem' }}>
                        {item.media_type === 'movie' ? 'Movie' : 'TV Show'} • {(item.release_date || item.first_air_date || '').substring(0, 4)}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              color: item.isCollected || isItemInAnyList(item.id) ? 'var(--accent)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                            }}
                          >
                            <Plus size={14} />
                          </button>
                          {activeDropdownId === item.id && (
                            <div style={{
                              position: 'absolute',
                              bottom: '24px',
                              left: 0,
                              zIndex: 101,
                              background: 'var(--bg-dark)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                              padding: '8px',
                              minWidth: '160px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              textAlign: 'left'
                            }} onClick={e => e.stopPropagation()}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                                <input
                                  type="checkbox"
                                  checked={item.isCollected}
                                  onChange={() => handleToggleCollection(item)}
                                />
                                Collection
                              </label>
                              {lists.map(list => {
                                const inList = listMemberships[item.id]?.[list.id];
                                return (
                                  <label key={list.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!inList}
                                      onChange={() => handleToggleList(item, list.id)}
                                    />
                                    {list.name}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            color: item.isWatched ? 'var(--accent)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                          onClick={() => handleAction('watch', item)}
                          title={item.isWatched ? "Watched" : "Watch"}
                        >
                          {item.isWatched ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="media-card-content">
                    <div
                      className="media-title"
                      title={item.title || item.name}
                      onClick={() => navigate(item.media_type === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.title || item.name}
                    </div>
                    <div className="media-meta">{item.media_type === 'movie' ? 'Movie' : 'TV Show'} • {(item.release_date || item.first_air_date || '').substring(0, 4)}</div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <button
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: item.isCollected || isItemInAnyList(item.id) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: item.isCollected || isItemInAnyList(item.id) ? 'rgb(96, 165, 250)' : 'var(--text-main)',
                            border: item.isCollected || isItemInAnyList(item.id) ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                        >
                          <Plus size={16} />
                        </button>

                        {activeDropdownId === item.id && (
                          <div style={{
                            position: 'absolute',
                            bottom: '40px',
                            left: 0,
                            zIndex: 10,
                            background: 'var(--bg-dark)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            padding: '8px',
                            minWidth: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }} onClick={e => e.stopPropagation()}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                              <input
                                type="checkbox"
                                checked={item.isCollected}
                                onChange={() => handleToggleCollection(item)}
                              />
                              Collection
                            </label>
                            {lists.map(list => {
                              const inList = listMemberships[item.id]?.[list.id];
                              return (
                                <label key={list.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!inList}
                                    onChange={() => handleToggleList(item, list.id)}
                                  />
                                  {list.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: item.isWatched ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: item.isWatched ? 'rgb(52, 211, 153)' : 'var(--text-main)',
                          border: item.isWatched ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => handleAction('watch', item)}
                        title={item.isWatched ? "Watched" : "Watch"}
                      >
                        {item.isWatched ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Item</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Year</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map(item => (
                <tr
                  key={item.id}
                  onClick={() => navigate(item.media_type === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: aspectRatio === 'landscape' ? '72px' : '36px',
                      height: aspectRatio === 'landscape' ? '40px' : '54px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.05)',
                      flexShrink: 0,
                      transition: 'width 0.2s, height 0.2s'
                    }}>
                      {aspectRatio === 'landscape' && item.backdrop_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${item.backdrop_path}`} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (item.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                          {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.title || item.name}</div>
                      <div className="mobile-only-meta" style={{ display: 'none' }}>
                        {item.media_type === 'movie' ? 'Movie' : 'TV Show'} • {(item.release_date || item.first_air_date || '').substring(0, 4)}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {(item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 10px',
                            background: item.isCollected || isItemInAnyList(item.id) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: item.isCollected || isItemInAnyList(item.id) ? 'rgb(96, 165, 250)' : 'var(--text-main)',
                            border: item.isCollected || isItemInAnyList(item.id) ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                        >
                          <Plus size={14} />
                          <span style={{ fontSize: '0.8rem' }}>Add</span>
                        </button>

                        {activeDropdownId === item.id && (
                          <div style={{
                            position: 'absolute',
                            bottom: '36px',
                            right: 0,
                            zIndex: 101,
                            background: 'var(--bg-dark)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            padding: '8px',
                            minWidth: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            textAlign: 'left'
                          }} onClick={e => e.stopPropagation()}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                              <input
                                type="checkbox"
                                checked={item.isCollected}
                                onChange={() => handleToggleCollection(item)}
                              />
                              Collection
                            </label>
                            {lists.map(list => {
                              const inList = listMemberships[item.id]?.[list.id];
                              return (
                                <label key={list.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!inList}
                                    onChange={() => handleToggleList(item, list.id)}
                                  />
                                  {list.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 10px',
                          background: item.isWatched ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: item.isWatched ? 'rgb(52, 211, 153)' : 'var(--text-main)',
                          border: item.isWatched ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => handleAction('watch', item)}
                        title={item.isWatched ? "Watched" : "Watch"}
                      >
                        {item.isWatched ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
};

export default Search;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Plus, Trash2, LayoutGrid, List as ListIcon, ChevronDown, ChevronRight, Sliders } from 'lucide-react';
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

const Lists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('lists_view_mode') || 'grid'); // 'grid' or 'list'
  
  // Display options states
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('lists_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('lists_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('lists_aspect_ratio') || 'portrait');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const colsRange = getColsRange(windowWidth, aspectRatio);
  const activeCols = aspectRatio === 'landscape' 
    ? Math.min(colsRange.max, Math.max(colsRange.min, colsLandscape)) 
    : Math.min(colsRange.max, Math.max(colsRange.min, colsPortrait));
  const gridSize = getGridSizeFromCols(activeCols, windowWidth, aspectRatio);

  const [collapsedLists, setCollapsedLists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lists_collapsed') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    localStorage.setItem('lists_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('lists_cols_portrait', colsPortrait);
  }, [colsPortrait]);

  useEffect(() => {
    localStorage.setItem('lists_cols_landscape', colsLandscape);
  }, [colsLandscape]);

  useEffect(() => {
    localStorage.setItem('lists_aspect_ratio', aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    localStorage.setItem('lists_collapsed', JSON.stringify(collapsedLists));
  }, [collapsedLists]);

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

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName) return;
    try {
      await api.post('/lists', { name: newListName });
      setNewListName('');
      fetchLists();
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  const handleRemoveItem = async (e, listId, mediaId) => {
    e.stopPropagation();
    try {
      await api.delete(`/lists/${listId}/items/${mediaId}`);
      fetchLists();
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handleDeleteList = async (e, listId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this list?")) {
      try {
        await api.delete(`/lists/${listId}`);
        fetchLists();
      } catch (err) {
        console.error('Failed to delete list:', err);
      }
    }
  };

  const toggleCollapse = (listId) => {
    setCollapsedLists(prev => ({
      ...prev,
      [listId]: !prev[listId]
    }));
  };

  const handleItemClick = (media) => {
    navigate(media.type === 'movie' ? `/movies/${media.tmdbId}` : `/shows/${media.tmdbId}`);
  };

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
      </div>
    );
  };

  const renderDisplayOptions = () => {
    return (
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
              minWidth: '400px',
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
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ margin: 0 }}>My Lists</h1>
        
        {renderDisplayOptions()}
      </div>
      
      <form onSubmit={handleCreateList} style={{ display: 'flex', gap: '12px', marginBottom: '32px', maxWidth: '500px' }}>
        <input 
          type="text" 
          className="input-field" 
          style={{ flex: 1 }} 
          placeholder="New List Name..." 
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          <Plus size={20} />
          Create
        </button>
      </form>

      {lists.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No lists created yet.</p>}

      {lists.map(list => {
        const isCollapsed = !!collapsedLists[list.id];
        return (
          <div key={list.id} className="glass-panel" style={{ marginBottom: '24px', padding: '20px' }}>
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '12px', 
                marginBottom: isCollapsed ? 0 : '16px',
                cursor: 'pointer' 
              }}
              onClick={() => toggleCollapse(list.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isCollapsed ? <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />}
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>
                  {list.name}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '400', marginLeft: '10px' }}>
                    ({list.items.length} items)
                  </span>
                </h2>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {list.name !== 'Watchlist' && (
                  <button 
                    onClick={(e) => handleDeleteList(e, list.id)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 size={16} />
                    <span>Delete List</span>
                  </button>
                )}
              </div>
            </div>
            
            {!isCollapsed && (
              list.items.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '8px 0 0 0' }}>Empty list.</p>
              ) : viewMode === 'grid' ? (
                <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
                  {list.items.map(({ media }) => {
                    const hasArtwork = aspectRatio === 'landscape' && media.backdropPath;
                    const imageUrl = hasArtwork 
                      ? `https://image.tmdb.org/t/p/w500${media.backdropPath}` 
                      : (media.posterPath ? `https://image.tmdb.org/t/p/w500${media.posterPath}` : null);
                    return (
                      <div 
                        key={media.id} 
                        className="media-card" 
                        onClick={() => handleItemClick(media)}
                        style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', aspectRatio: hasArtwork ? '16/9' : 'auto' }}
                      >
                        {imageUrl ? (
                          <LazyImage src={imageUrl} alt={media.title} style={{ aspectRatio: hasArtwork ? '16/9' : '2/3', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: hasArtwork ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            No Cover
                          </div>
                        )}
                        {hasArtwork ? (
                          <div className="media-card-content-overlay">
                            <div className="media-title" title={media.title} style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{media.title}</div>
                            <div className="media-meta" style={{ fontSize: '0.75rem' }}>
                              {media.type === 'movie' ? 'Movie' : 'TV Show'} • {(media.releaseDate || '').substring(0, 4) || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <div className="media-card-content">
                            <div className="media-title" title={media.title}>{media.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {media.type === 'movie' ? 'Movie' : 'TV Show'} • {(media.releaseDate || '').substring(0, 4) || 'N/A'}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={(e) => handleRemoveItem(e, list.id, media.id)}
                          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.95)', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 10 }}
                          title="Remove from list"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '8px' }}>
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
                      {list.items.map(({ media }) => (
                        <tr 
                          key={media.id} 
                          onClick={() => handleItemClick(media)}
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
                               {aspectRatio === 'landscape' && media.backdropPath ? (
                                 <img src={`https://image.tmdb.org/t/p/w92${media.backdropPath}`} alt={media.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               ) : (media.posterPath ? (
                                 <img src={`https://image.tmdb.org/t/p/w92${media.posterPath}`} alt={media.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               ) : (
                                 <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                                   {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                                 </div>
                               ))}
                             </div>
                             <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{media.title}</div>
                              <div style={{ display: 'none' /* fallback mobile label */ }} className="mobile-only-meta">
                                {media.type === 'movie' ? 'Movie' : 'TV Show'} • {(media.releaseDate || '').substring(0, 4)}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            {media.type === 'movie' ? 'Movie' : 'TV Show'}
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {(media.releaseDate || '').substring(0, 4) || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button 
                              onClick={(e) => handleRemoveItem(e, list.id, media.id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}
                              title="Remove from list"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        );
      })}
      
      <style>{`
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
};

export default Lists;

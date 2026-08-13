import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { 
  ArrowLeft, LayoutGrid, List as ListIcon, Sliders, CheckCircle, 
  Bookmark, Edit2, Lock, Link as LinkIcon, Globe, Trash2, Search as SearchIcon, Copy, Users
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import MobileBottomSheet from '../components/MobileBottomSheet';
import ListConfigModal from '../components/ListConfigModal';
import { AuthContext } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

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

const ListDetails = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { showAlert, showConfirm } = useModal();
  
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  
  // Display options states
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('list_details_view_mode') || 'grid');
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('list_details_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('list_details_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('list_details_aspect_ratio') || 'portrait');
  const [sortOrder, setSortOrder] = useState('default');
  
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
    fetchList();
  }, [shareId]);

  useEffect(() => {
    localStorage.setItem('list_details_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('list_details_cols_portrait', colsPortrait);
  }, [colsPortrait]);

  useEffect(() => {
    localStorage.setItem('list_details_cols_landscape', colsLandscape);
  }, [colsLandscape]);

  useEffect(() => {
    localStorage.setItem('list_details_aspect_ratio', aspectRatio);
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
    const handleClose = () => setIsDisplayMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/lists/shared/${shareId}`);
      setList(res.data);
      if (sortOrder === 'default' && res.data.defaultOrder) {
        setSortOrder(res.data.defaultOrder);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch list:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      setError(err.response?.data?.error || 'Failed to load list');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (e, mediaId) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await api.delete(`/lists/${list.id}/items/${mediaId}`);
      setList(prev => ({
        ...prev,
        items: prev.items.filter(item => item.media.id !== mediaId)
      }));
    } catch (err) {
      console.error('Failed to remove item:', err);
      showAlert('Failed to remove item', 'error');
    }
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

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Sort Order</div>
          <select 
            className="input-field"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
          >
            <option value="default">List Default</option>
            <option value="added">Added (Newest)</option>
            <option value="titleAsc">Title A-Z</option>
            <option value="titleDesc">Title Z-A</option>
            <option value="releaseDate">Release Year</option>
          </select>
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
      </div>
    );
  };

  const getSortedItems = () => {
    if (!list) return [];
    
    let items = [...list.items];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.media.title.toLowerCase().includes(q));
    }
    
    if (mediaType !== 'all') {
      items = items.filter(item => item.media.type === mediaType);
    }
    
    const activeSort = sortOrder === 'default' ? (list.defaultOrder || 'added') : sortOrder;

    switch (activeSort) {
      case 'titleAsc':
        items.sort((a, b) => a.media.title.localeCompare(b.media.title));
        break;
      case 'titleDesc':
        items.sort((a, b) => b.media.title.localeCompare(a.media.title));
        break;
      case 'releaseDate':
        items.sort((a, b) => {
          const dateA = new Date(a.media.releaseDate || '1900-01-01').getTime();
          const dateB = new Date(b.media.releaseDate || '1900-01-01').getTime();
          return dateB - dateA; // Newest first
        });
        break;
      case 'added':
      default:
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest added first
        break;
    }
    
    return items;
  };

  if (loading) {
    return <div className="media-page-container"><div className="loading-spinner" /></div>;
  }

  if (error || !list) {
    return (
      <div className="media-page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Lock size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3>Access Denied or List Not Found</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/lists')} style={{ marginTop: '20px' }}>
            Back to Lists
          </button>
        </div>
      </div>
    );
  }

  const isPending = () => {
    if (!list || !user) return false;
    try {
      const shared = JSON.parse(list.sharedWith || '[]');
      const userShare = shared.find(s => typeof s === 'object' && s.id === user.id);
      return userShare && userShare.status === 'pending';
    } catch (e) {
      return false;
    }
  };

  const handleRespondToInvite = async (accept) => {
    try {
      await api.post(`/lists/shared/${shareId}/respond`, { accept });
      if (accept) {
        fetchList();
        showAlert('List invitation accepted', 'success');
      } else {
        navigate('/lists');
        showAlert('List invitation rejected', 'info');
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
      showAlert('Failed to respond to invite', 'error');
    }
  };

  const handleCopyList = async () => {
    const confirmed = await showConfirm("Copy this list to your own lists?");
    if (!confirmed) return;
    try {
      const res = await api.post(`/lists/shared/${shareId}/copy`);
      showAlert('List copied successfully', 'success');
      navigate(`/lists/${res.data.shareId}`);
    } catch (err) {
      console.error('Failed to copy list:', err);
      showAlert('Failed to copy list', 'error');
    }
  };

  const isOwner = user?.id === list.userId;
  const sortedItems = getSortedItems();

  return (
    <div className="media-page-container">
      <div className="page-header page-header-discover" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', gridArea: 'title' }}>
          {user && (
            <button className="btn btn-secondary" onClick={() => navigate('/lists')} style={{ padding: '8px' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            {list.name}
            {list.visibility === 'PUBLIC' && <Globe size={18} style={{ color: 'var(--text-muted)' }} title="Public List" />}
            {list.visibility === 'LINK' && <LinkIcon size={18} style={{ color: 'var(--text-muted)' }} title="Link Shared List" />}
            {list.visibility === 'INVITE' && (list.sharedWith && list.sharedWith !== '[]' && list.sharedWith !== 'null' && JSON.parse(list.sharedWith || '[]').length > 0 ? (
              <Users size={18} style={{ color: 'var(--text-muted)' }} title="Shared List" />
            ) : (
              <Lock size={18} style={{ color: 'var(--text-muted)' }} title="Private List" />
            ))}
          </h1>
        </div>
        
        <div className="type-toggle-group" style={{ margin: 0 }}>
            <button
              type="button"
              className={`type-toggle-btn ${mediaType === 'all' ? 'active' : ''}`}
              onClick={() => setMediaType('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`type-toggle-btn ${mediaType === 'tv' ? 'active' : ''}`}
              onClick={() => setMediaType('tv')}
            >
              TV Shows
            </button>
            <button
              type="button"
              className={`type-toggle-btn ${mediaType === 'movie' ? 'active' : ''}`}
              onClick={() => setMediaType('movie')}
            >
              Movies
            </button>
          </div>
        
        <div className="display-options-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isOwner && (
            <button className="btn btn-secondary display-options-btn" onClick={() => setIsModalOpen(true)}>
              <Edit2 size={16} />
              <span className="hide-on-mobile">Edit List</span>
            </button>
          )}
          {user && !isOwner && (
            <button className="btn btn-secondary display-options-btn" onClick={handleCopyList} title="Copy this list">
              <Copy size={16} />
              <span className="hide-on-mobile">Copy List</span>
            </button>
          )}

          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button 
              type="button"
              className="btn btn-secondary display-options-btn" 
              onClick={() => setIsDisplayMenuOpen(prev => !prev)}
            >
              <Sliders size={16} />
              <span className="display-options-text hide-on-mobile">Display</span>
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
                  minWidth: '350px',
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
      </div>


      {isPending() && (
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--accent)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0' }}>You've been invited!</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>{list.user?.username} invited you to this list.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => handleRespondToInvite(false)}>Decline</button>
            <button className="btn btn-primary" onClick={() => handleRespondToInvite(true)}>Accept Invite</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          By {list.user.username} • {list.items.length} items
        </span>
        
        <div style={{ position: 'relative', width: '250px' }} className="hide-on-mobile">
          <input 
            type="text"
            className="input-field"
            placeholder="Search in list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
          <SearchIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>
      
      {isMobile && (
        <div style={{ position: 'relative', width: '100%', marginBottom: '24px' }}>
          <input 
            type="text"
            className="input-field"
            placeholder="Search in list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
          <SearchIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      )}

      {sortedItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>{searchQuery ? 'No items match your search.' : 'This list is empty.'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
          {sortedItems.map(({ media }) => {
            const hasArtwork = aspectRatio === 'landscape' && media.backdropPath;
            const imageUrl = hasArtwork 
              ? `https://image.tmdb.org/t/p/w500${media.backdropPath}` 
              : (media.posterPath ? `https://image.tmdb.org/t/p/w500${media.posterPath}` : null);
            
            return (
              <Link 
                key={media.id} 
                to={media.type === 'movie' ? `/movies/${media.tmdbId}` : `/shows/${media.tmdbId}`}
                className="media-card" 
                style={{ position: 'relative', overflow: 'hidden', aspectRatio: hasArtwork ? '16/9' : 'auto' }}
              >
                {imageUrl ? (
                  <LazyImage src={imageUrl} alt={media.title} style={{ aspectRatio: hasArtwork ? '16/9' : '2/3', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: hasArtwork ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    No Cover
                  </div>
                )}
                
                <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 }}>
                  {media.isRequested && (
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.725rem', fontWeight: '600', background: 'rgba(245, 158, 11, 0.9)', color: '#fff', backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.15)' }}>
                      Requested
                    </span>
                  )}
                  {media.isCollected && (
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.725rem', fontWeight: '600', background: 'rgba(59, 130, 246, 0.9)', color: '#fff', backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.15)' }}>
                      Collected
                    </span>
                  )}
                  {media.isWatched && (
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.725rem', fontWeight: '600', background: 'rgba(16, 185, 129, 0.9)', color: '#fff', backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.15)' }}>
                      Watched
                    </span>
                  )}
                </div>

                {isOwner && (
                  <button 
                    onClick={(e) => handleRemoveItem(e, media.id)}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.95)', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 10 }}
                    title="Remove from list"
                  >
                    <Trash2 size={14} />
                  </button>
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
              </Link>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Item</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Year</th>
                {isOwner && <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(({ media }) => (
                <tr 
                  key={media.id} 
                  onClick={() => navigate(media.type === 'movie' ? `/movies/${media.tmdbId}` : `/shows/${media.tmdbId}`)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'inherit' }}>
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
                            <img src={`https://image.tmdb.org/t/p/w92${media.backdropPath}`} alt={media.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                          ) : (media.posterPath ? (
                            <img src={`https://image.tmdb.org/t/p/w92${media.posterPath}`} alt={media.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                              {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                            </div>
                          ))}
                        </div>
                        <div>
                        <div className="hover-underline-title" style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{media.title}</div>
                        <div style={{ display: 'none' /* fallback mobile label */ }} className="mobile-only-meta">
                          {media.type === 'movie' ? 'Movie' : 'TV Show'} • {(media.releaseDate || '').substring(0, 4)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {media.isCollected && (
                        <span className="badge badge-info">Collected</span>
                      )}
                      {media.isWatched && (
                        <span className="badge badge-success">Watched</span>
                      )}
                      {media.isRequested && (
                        <span className="badge badge-warning">Requested</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {media.type === 'movie' ? 'Movie' : 'TV Show'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {(media.releaseDate || '').substring(0, 4) || 'N/A'}
                  </td>
                  {isOwner && (
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button 
                        onClick={(e) => handleRemoveItem(e, media.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}
                        title="Remove from list"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
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
        .table-row-hover:hover .hover-underline-title {
          text-decoration: underline;
        }
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
      
      <ListConfigModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        list={list}
        onSuccess={fetchList}
      />
    </div>
  );
};

export default ListDetails;

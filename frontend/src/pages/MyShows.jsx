import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import api from '../api';
import { Tv, Search, Star, Play, Check, Trash2, X, ChevronRight, Eye, Plus, Calendar, Sliders, LayoutGrid, List as ListIcon } from 'lucide-react';
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

const MyShows = () => {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('shows_search_query') || '');
  const [filterType, setFilterType] = useState(() => localStorage.getItem('shows_filter_type') || 'all'); // 'all', 'completed', 'progress'
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('shows_sort_by') || 'alphabetical'); // 'alphabetical', 'releaseDate', 'collectedAt'

  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const searchBarRef = useRef(null);
  const lastScrollY = useRef(0);
  const currentTranslation = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const deltaY = currentScrollY - lastScrollY.current;

      // Determine the sliding limit
      let limitY = 0;
      const isSearchActive = searchQuery.trim() !== '';
      if (isSearchActive) {
        limitY = searchBarRef.current ? Math.max(0, searchBarRef.current.offsetTop - 16) : 80;
      } else {
        limitY = containerRef.current ? containerRef.current.offsetHeight : 140;
      }

      if (currentScrollY <= 0) {
        currentTranslation.current = 0;
      } else {
        let nextTranslation = currentTranslation.current - deltaY;
        if (nextTranslation < -limitY) nextTranslation = -limitY;
        if (nextTranslation > 0) nextTranslation = 0;
        currentTranslation.current = nextTranslation;
      }

      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${currentTranslation.current}px)`;
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [searchQuery]);

  useEffect(() => {
    currentTranslation.current = 0;
    if (containerRef.current) {
      containerRef.current.style.transform = 'translateY(0px)';
    }
  }, [searchQuery]);

  // Display options states
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('shows_view_mode') || 'grid');
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('shows_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('shows_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('shows_aspect_ratio') || 'portrait');
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
    localStorage.setItem('shows_view_mode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('shows_cols_portrait', colsPortrait);
  }, [colsPortrait]);
  useEffect(() => {
    localStorage.setItem('shows_cols_landscape', colsLandscape);
  }, [colsLandscape]);
  useEffect(() => {
    localStorage.setItem('shows_aspect_ratio', aspectRatio);
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

        {/* Visibility Filters */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Visibility</div>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            className="input-field"
            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <option value="all">All ({shows.length})</option>
            <option value="completed">Completed ({shows.filter(s => s.totalEpisodes > 0 && s.watchedCount >= s.totalEpisodes).length})</option>
            <option value="progress">In Progress ({shows.filter(s => s.totalEpisodes === 0 || s.watchedCount < s.totalEpisodes).length})</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Sort Order</div>
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
            className="input-field"
            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <option value="alphabetical">Alphabetical</option>
            <option value="releaseDate">Release Date</option>
            <option value="collectedAt">Date Collected</option>
          </select>
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

  const [randomBackdrop] = useState(() => {
    const backdrops = [
      'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1280&q=80', // Modern retro-glowing TV setup
      'https://images.unsplash.com/photo-1558882224-cca166733360?auto=format&fit=crop&w=1280&q=80', // Warm cozy living room TV
      'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?auto=format&fit=crop&w=1280&q=80', // Cozy TV media center lounge
      'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1280&q=80', // Premium home theater / projector setup
      'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1280&q=80', // Vintage TV / media art
      'https://images.unsplash.com/photo-1574375927938-d5a98e8fed85?auto=format&fit=crop&w=1280&q=80'  // Netflix/Streaming smart TV interface on screen
    ];
    return backdrops[Math.floor(Math.random() * backdrops.length)];
  });

  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  useEffect(() => {
    sessionStorage.setItem('shows_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('shows_filter_type', filterType);
  }, [filterType]);

  useEffect(() => {
    localStorage.setItem('shows_sort_by', sortBy);
  }, [sortBy]);

  // Scroll restoration and sidebar click reset logic
  useEffect(() => {
    if (!loading) {
      if (navigationType === 'POP') {
        const savedScrollPos = sessionStorage.getItem('shows_scroll_pos');
        if (savedScrollPos) {
          const timer = setTimeout(() => {
            window.scrollTo(0, parseInt(savedScrollPos, 10));
          }, 50);
          return () => clearTimeout(timer);
        }
      } else {
        // If PUSH (e.g. sidebar navigation clicked), reset scroll position and search
        setSearchQuery('');
        window.scrollTo(0, 0);
        sessionStorage.removeItem('shows_scroll_pos');
        sessionStorage.removeItem('shows_search_query');
      }
    }
  }, [loading, navigationType]);

  // Save scroll position during scroll events
  useEffect(() => {
    const handleScroll = () => {
      if (!loading) {
        sessionStorage.setItem('shows_scroll_pos', window.scrollY);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const fetchShows = async () => {
    try {
      const res = await api.get('/media/shows');
      setShows(res.data);
    } catch (err) {
      console.error('Failed to fetch shows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tmdbIdParam = params.get('tmdbId');
    const seasonParam = params.get('season');
    if (tmdbIdParam) {
      const seasonQuery = seasonParam ? `?season=${seasonParam}` : '';
      navigate(`/shows/${tmdbIdParam}${seasonQuery}`, { replace: true });
    }
  }, [location, navigate]);


  // Helper to normalize titles for alphabetical sorting & grouping
  const getSortTitle = (title) => {
    if (!title) return '';
    const trimmed = title.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('the ')) {
      return trimmed.substring(4).trim();
    }
    if (lower.startsWith('a ')) {
      return trimmed.substring(2).trim();
    }
    return trimmed;
  };

  const getFirstLetter = (title) => {
    const sortTitle = getSortTitle(title);
    if (!sortTitle) return '#';
    const firstChar = sortTitle[0].toUpperCase();
    if (firstChar >= 'A' && firstChar <= 'Z') {
      return firstChar;
    }
    return '#';
  };

  // Filters and searches
  const filteredShows = shows.filter(show => {
    const matchesSearch = show.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const completionRate = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) : 0;

    if (filterType === 'completed') return completionRate >= 1 && show.totalEpisodes > 0;
    if (filterType === 'progress') return completionRate < 1 || show.totalEpisodes === 0;
    return true;
  });

  // Sort logic
  const getSortedShows = (showList) => {
    const listCopy = [...showList];
    if (sortBy === 'alphabetical') {
      return listCopy.sort((a, b) => {
        const titleA = getSortTitle(a.title);
        const titleB = getSortTitle(b.title);
        return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
      });
    } else if (sortBy === 'releaseDate') {
      return listCopy.sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return new Date(b.releaseDate) - new Date(a.releaseDate); // Newest first
      });
    } else if (sortBy === 'collectedAt') {
      return listCopy.sort((a, b) => {
        if (!a.collectedAt) return 1;
        if (!b.collectedAt) return -1;
        return new Date(b.collectedAt) - new Date(a.collectedAt); // Newest collected first
      });
    }
    return listCopy;
  };

  const sortedFilteredShows = getSortedShows(filteredShows);

  // Group by letter for alphabetical view
  const groupedShows = {};
  if (sortBy === 'alphabetical') {
    sortedFilteredShows.forEach(show => {
      const letter = getFirstLetter(show.title);
      if (!groupedShows[letter]) {
        groupedShows[letter] = [];
      }
      groupedShows[letter].push(show);
    });
  }

  const availableLetters = Object.keys(groupedShows);

  // Card renderer to prevent code duplication
  const renderShowCard = (show) => {
    const completionRate = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) : 0;
    const percentage = Math.round(completionRate * 100);
    const unwatchedCount = Math.max(0, show.totalEpisodes - show.watchedCount);

    const hasArtwork = aspectRatio === 'landscape' && show.backdropPath;
    const imageUrl = hasArtwork 
      ? `https://image.tmdb.org/t/p/w500${show.backdropPath}` 
      : (show.posterPath ? `https://image.tmdb.org/t/p/w500${show.posterPath}` : null);

    return (
      <div key={show.id} className="media-card" onClick={() => navigate(`/shows/${show.tmdbId}`)} style={{ position: 'relative', overflow: 'hidden', aspectRatio: hasArtwork ? '16/9' : 'auto' }}>
        {imageUrl ? (
          <LazyImage src={imageUrl} alt={show.title} style={{ aspectRatio: hasArtwork ? '16/9' : '2/3', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: hasArtwork ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No Poster
          </div>
        )}

        {/* Unwatched Badge */}
        {unwatchedCount > 0 && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#fff',
              backdropFilter: 'blur(4px)'
            }}>
              {unwatchedCount} Left
            </span>
          </div>
        )}
        {unwatchedCount === 0 && show.totalEpisodes > 0 && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: 'rgba(16, 185, 129, 0.95)',
              color: '#fff',
              backdropFilter: 'blur(4px)'
            }}>
              Completed
            </span>
          </div>
        )}

        {hasArtwork ? (
          <div className="media-card-content-overlay" onClick={e => e.stopPropagation()}>
            <div className="media-title" title={show.title} style={{ fontSize: '0.9rem', marginBottom: '2px', cursor: 'pointer' }} onClick={() => navigate(`/shows/${show.tmdbId}`)}>{show.title}</div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
              <div style={{ width: `${percentage}%`, height: '100%', background: percentage === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '2px' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>{show.watchedCount}/{show.totalEpisodes || '?'} Ep</span>
              <span>{percentage}%</span>
            </div>
          </div>
        ) : (
          <div className="media-card-content">
            <div className="media-title" title={show.title}>{show.title}</div>

            {/* Watched Progress bar */}
            <div style={{ marginTop: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>{show.watchedCount} / {show.totalEpisodes || '?'} Ep</span>
                <span>{percentage}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', background: percentage === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '3px' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dramatic-loading-container" style={{ backgroundImage: `url(${randomBackdrop})` }}>
        <div className="dramatic-loading-overlay"></div>
        <div className="dramatic-loading-card">
          <div className="dramatic-loading-icon-wrapper">
            <div className="dramatic-loading-spinner-wrapper"></div>
            <Tv size={32} />
          </div>
          <div>
            <h3 className="dramatic-loading-title">Loading TV Shows</h3>
            <p className="dramatic-loading-subtitle">Retrieving your collected shows and episodes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`media-page-container ${sortBy === 'alphabetical' && sortedFilteredShows.length > 0 ? 'has-alphabet-sidebar' : ''}`}>
      <div ref={containerRef} className="sticky-header-container">
        <div ref={headerRef} className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <Tv style={{ color: 'var(--accent)' }} size={28} />
            My TV Shows
          </h1>

          {renderDisplayOptions()}
        </div>

        {/* Sticky Search Input */}
        <div ref={searchBarRef} className="sticky-search-container">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search TV show titles..."
              className="input-field"
              style={{ width: '100%', paddingLeft: '48px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Shows Content */}
      {sortedFilteredShows.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Tv size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>No Shows Found</h3>
          <p style={{ color: 'var(--text-muted)' }}>Try adjusting your filters or importing data in Settings.</p>
        </div>
      ) : viewMode === 'grid' ? (
        sortBy === 'alphabetical' ? (
          <div>
            {Object.keys(groupedShows).sort().map(letter => (
              <div key={letter} id={`letter-${letter}`} style={{ scrollMarginTop: '100px', marginBottom: '32px' }}>
                <h3 style={{
                  fontSize: '1.4rem',
                  fontWeight: '700',
                  color: 'var(--accent)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingBottom: '8px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {letter}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                    ({groupedShows[letter].length})
                  </span>
                </h3>
                 <div className="media-grid" style={{ marginTop: '12px', gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
                  {groupedShows[letter].map(show => renderShowCard(show))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
            {sortedFilteredShows.map(show => renderShowCard(show))}
          </div>
        )
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Show</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Progress</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }}>Episodes</th>
              </tr>
            </thead>
            <tbody>
              {sortBy === 'alphabetical' ? (
                Object.keys(groupedShows).sort().map(letter => (
                  <React.Fragment key={letter}>
                    <tr id={`letter-${letter}`} style={{ scrollMarginTop: '100px' }}>
                      <td colSpan={4} style={{ padding: '16px 8px 8px 8px', color: 'var(--accent)', fontWeight: '700', fontSize: '1.1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        {letter}
                      </td>
                    </tr>
                    {groupedShows[letter].map(show => {
                      const completionRate = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) : 0;
                      const percentage = Math.round(completionRate * 100);
                      return (
                        <tr 
                          key={show.id} 
                          onClick={() => navigate(`/shows/${show.tmdbId}`)}
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
                              {aspectRatio === 'landscape' && show.backdropPath ? (
                                <img src={`https://image.tmdb.org/t/p/w92${show.backdropPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (show.posterPath ? (
                                <img src={`https://image.tmdb.org/t/p/w92${show.posterPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                                  {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                                </div>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{show.title}</div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            TV Show
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem', width: '200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${percentage}%`, height: '100%', background: percentage === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '0.8rem' }}>{percentage}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {show.watchedCount} / {show.totalEpisodes || '?'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                sortedFilteredShows.map(show => {
                  const completionRate = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) : 0;
                  const percentage = Math.round(completionRate * 100);
                  return (
                    <tr 
                      key={show.id} 
                      onClick={() => navigate(`/shows/${show.tmdbId}`)}
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
                          {aspectRatio === 'landscape' && show.backdropPath ? (
                            <img src={`https://image.tmdb.org/t/p/w92${show.backdropPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (show.posterPath ? (
                            <img src={`https://image.tmdb.org/t/p/w92${show.posterPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                              {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{show.title}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        TV Show
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem', width: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: percentage === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ fontSize: '0.8rem' }}>{percentage}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {show.watchedCount} / {show.totalEpisodes || '?'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Alphabet Sidebar (Alphabetical mode only) */}
      {sortBy === 'alphabetical' && sortedFilteredShows.length > 0 && (
        <div className="alphabet-sidebar">
          {['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(letter => {
            const hasItems = availableLetters.includes(letter);
            return (
              <button
                key={letter}
                disabled={!hasItems}
                onClick={() => {
                  const element = document.getElementById(`letter-${letter}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* Side padding spacing adjustment */}
    </div>
  );
};

export default MyShows;


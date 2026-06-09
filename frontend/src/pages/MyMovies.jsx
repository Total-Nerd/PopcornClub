import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff, Search, Film, Star, Clock, Calendar, Check, Trash2, X, Sliders, LayoutGrid, List as ListIcon } from 'lucide-react';
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

const MyMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('movies_search_query') || '');
  const [filterType, setFilterType] = useState(() => localStorage.getItem('movies_filter_type') || 'all'); // 'all', 'watched', 'unwatched'
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('movies_sort_by') || 'alphabetical'); // 'alphabetical', 'releaseDate', 'collectedAt'

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
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('movies_view_mode') || 'grid');
  const [colsPortrait, setColsPortrait] = useState(() => {
    const saved = localStorage.getItem('movies_cols_portrait');
    return saved ? parseInt(saved, 10) : getDefaultCols('portrait');
  });
  const [colsLandscape, setColsLandscape] = useState(() => {
    const saved = localStorage.getItem('movies_cols_landscape');
    return saved ? parseInt(saved, 10) : getDefaultCols('landscape');
  });
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('movies_aspect_ratio') || 'portrait');
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
    localStorage.setItem('movies_view_mode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('movies_cols_portrait', colsPortrait);
  }, [colsPortrait]);
  useEffect(() => {
    localStorage.setItem('movies_cols_landscape', colsLandscape);
  }, [colsLandscape]);
  useEffect(() => {
    localStorage.setItem('movies_aspect_ratio', aspectRatio);
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
            <option value="all">All ({movies.length})</option>
            <option value="watched">Watched ({movies.filter(m => m.isWatched).length})</option>
            <option value="unwatched">Unwatched ({movies.filter(m => !m.isWatched).length})</option>
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
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1280&q=80', // Cinema Theater
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1280&q=80', // Projector light / Theater seats
      'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1280&q=80', // Movie slate/camera gear
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1280&q=80', // Film reel / Cine projection
      'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1280&q=80', // Anamorphic camera lens / film shoot
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1280&q=80'  // Vibrant cinema neon glow
    ];
    return backdrops[Math.floor(Math.random() * backdrops.length)];
  });

  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  useEffect(() => {
    sessionStorage.setItem('movies_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('movies_filter_type', filterType);
  }, [filterType]);

  useEffect(() => {
    localStorage.setItem('movies_sort_by', sortBy);
  }, [sortBy]);

  // Scroll restoration and sidebar click reset logic
  useEffect(() => {
    if (!loading) {
      if (navigationType === 'POP') {
        const savedScrollPos = sessionStorage.getItem('movies_scroll_pos');
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
        sessionStorage.removeItem('movies_scroll_pos');
        sessionStorage.removeItem('movies_search_query');
      }
    }
  }, [loading, navigationType]);

  // Save scroll position during scroll events
  useEffect(() => {
    const handleScroll = () => {
      if (!loading) {
        sessionStorage.setItem('movies_scroll_pos', window.scrollY);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const fetchMovies = async () => {
    try {
      const res = await api.get('/media/movies');
      setMovies(res.data);
    } catch (err) {
      console.error('Failed to fetch movies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tmdbIdParam = params.get('tmdbId');
    if (tmdbIdParam) {
      navigate(`/movies/${tmdbIdParam}`, { replace: true });
    }
  }, [location, navigate]);

  const handleToggleWatch = async (e, movie) => {
    e.stopPropagation();
    try {
      const isCurrentlyWatched = movie.isWatched;
      await api.post('/media/watch', {
        tmdbId: movie.tmdbId,
        type: 'movie',
        title: movie.title,
        overview: movie.overview,
        releaseDate: movie.releaseDate,
        posterPath: movie.posterPath,
        remove: isCurrentlyWatched // if currently watched, remove it (make unwatched)
      });

      // Update local state
      setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, isWatched: !isCurrentlyWatched } : m));
    } catch (err) {
      console.error('Failed to toggle watch status', err);
    }
  };


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

  // Filters
  const filteredMovies = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'watched') return movie.isWatched;
    if (filterType === 'unwatched') return !movie.isWatched;
    return true;
  });

  // Sort logic
  const getSortedMovies = (movieList) => {
    const listCopy = [...movieList];
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

  const sortedFilteredMovies = getSortedMovies(filteredMovies);

  // Group by letter for alphabetical view
  const groupedMovies = {};
  if (sortBy === 'alphabetical') {
    sortedFilteredMovies.forEach(movie => {
      const letter = getFirstLetter(movie.title);
      if (!groupedMovies[letter]) {
        groupedMovies[letter] = [];
      }
      groupedMovies[letter].push(movie);
    });
  }

  const availableLetters = Object.keys(groupedMovies);

  // Card renderer to prevent code duplication
  const renderMovieCard = (movie) => {
    const isLandscape = aspectRatio === 'landscape';
    const imageUrl = isLandscape
      ? (movie.backdropPath ? `https://image.tmdb.org/t/p/w500${movie.backdropPath}` : null)
      : (movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null);

    return (
      <div key={movie.id} className="media-card" onClick={() => navigate(`/movies/${movie.tmdbId}`)} style={{ position: 'relative', overflow: 'hidden', aspectRatio: isLandscape ? '16/9' : 'auto' }}>
        {imageUrl ? (
          <LazyImage src={imageUrl} alt={movie.title} style={{ aspectRatio: isLandscape ? '16/9' : '2/3', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: isLandscape ? '16/9' : '2/3', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
            {isLandscape ? 'No artwork' : 'No Poster'}
          </div>
        )}

        {/* Watched pill indicators */}
        <div 
          style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}
          onClick={(e) => handleToggleWatch(e, movie)}
        >
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600',
            background: movie.isWatched ? 'var(--success)' : 'rgba(148, 163, 184, 0.9)',
            color: '#fff',
            backdropFilter: 'blur(4px)',
            cursor: 'pointer',
            display: 'inline-block',
            transition: 'background 0.2s ease, transform 0.1s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
          className="watched-pill-clickable"
          >
            {movie.isWatched ? 'Watched' : 'Unwatched'}
          </span>
        </div>

        {isLandscape ? (
          <div className="media-card-content-overlay" onClick={e => e.stopPropagation()}>
            <div className="media-title" title={movie.title} style={{ fontSize: '0.9rem', marginBottom: '2px', cursor: 'pointer' }} onClick={() => navigate(`/movies/${movie.tmdbId}`)}>{movie.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div className="media-meta" style={{ fontSize: '0.75rem' }}>
                {movie.releaseDate ? movie.releaseDate.substring(0, 4) : 'Unknown Year'}
              </div>
            </div>
          </div>
        ) : (
          <div className="media-card-content">
            <div className="media-title" title={movie.title}>{movie.title}</div>
            <div className="media-meta">
              {movie.releaseDate ? movie.releaseDate.substring(0, 4) : 'Unknown Year'}
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
            <Film size={32} />
          </div>
          <div>
            <h3 className="dramatic-loading-title">Loading Movies</h3>
            <p className="dramatic-loading-subtitle">Retrieving your collected movies and playback states...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`media-page-container ${sortBy === 'alphabetical' && sortedFilteredMovies.length > 0 ? 'has-alphabet-sidebar' : ''}`}>
      <div ref={containerRef} className="sticky-header-container">
        <div ref={headerRef} className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <Film style={{ color: 'var(--accent)' }} size={28} />
            My Movies
          </h1>

          {renderDisplayOptions()}
        </div>

        {/* Sticky Search Input */}
        <div ref={searchBarRef} className="sticky-search-container">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search movie titles..."
              className="input-field"
              style={{ width: '100%', paddingLeft: '48px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        sortBy === 'alphabetical' ? (
          <div>
            {Object.keys(groupedMovies).sort().map(letter => (
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
                    ({groupedMovies[letter].length})
                  </span>
                </h3>
                <div className="media-grid" style={{ marginTop: '12px', gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
                  {groupedMovies[letter].map(movie => renderMovieCard(movie))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="media-grid" style={{ gridTemplateColumns: isMobile ? `repeat(${activeCols}, 1fr)` : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: isMobile ? '12px' : (gridSize < 140 ? '12px' : '24px') }}>
            {sortedFilteredMovies.map(movie => renderMovieCard(movie))}
          </div>
        )
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Movie</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Year</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortBy === 'alphabetical' ? (
                Object.keys(groupedMovies).sort().map(letter => (
                  <React.Fragment key={letter}>
                    <tr id={`letter-${letter}`} style={{ scrollMarginTop: '100px' }}>
                      <td colSpan={4} style={{ padding: '16px 8px 8px 8px', color: 'var(--accent)', fontWeight: '700', fontSize: '1.1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        {letter}
                      </td>
                    </tr>
                    {groupedMovies[letter].map(movie => (
                      <tr
                        key={movie.id}
                        onClick={() => navigate(`/movies/${movie.tmdbId}`)}
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
                            {aspectRatio === 'landscape' ? (
                              movie.backdropPath ? (
                                <img src={`https://image.tmdb.org/t/p/w92${movie.backdropPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem', fontWeight: '600' }}>
                                  No artwork
                                </div>
                              )
                            ) : (movie.posterPath ? (
                              <img src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                                No Cover
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{movie.title}</div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          Movie
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {(movie.releaseDate || '').substring(0, 4) || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <span
                            onClick={e => handleToggleWatch(e, movie)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: movie.isWatched ? 'var(--success)' : 'var(--overlay-strong)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              display: 'inline-block',
                              transition: 'all 0.2s ease',
                              border: '1px solid var(--border-color)'
                            }}
                            className="watched-pill"
                          >
                            {movie.isWatched ? 'Watched' : 'Unwatched'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                sortedFilteredMovies.map(movie => (
                  <tr
                    key={movie.id}
                    onClick={() => navigate(`/movies/${movie.tmdbId}`)}
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
                        {aspectRatio === 'landscape' && movie.backdropPath ? (
                          <img src={`https://image.tmdb.org/t/p/w92${movie.backdropPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (movie.posterPath ? (
                          <img src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                            {aspectRatio === 'landscape' ? 'No Art' : 'No Cover'}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{movie.title}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      Movie
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {(movie.releaseDate || '').substring(0, 4) || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <span
                        onClick={e => handleToggleWatch(e, movie)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: movie.isWatched ? 'var(--success)' : 'var(--overlay-strong)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'inline-block',
                          transition: 'all 0.2s ease',
                          border: '1px solid var(--border-color)'
                        }}
                        className="watched-pill"
                      >
                        {movie.isWatched ? 'Watched' : 'Unwatched'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Alphabet Sidebar (Alphabetical mode only) */}
      {sortBy === 'alphabetical' && sortedFilteredMovies.length > 0 && (
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

export default MyMovies;

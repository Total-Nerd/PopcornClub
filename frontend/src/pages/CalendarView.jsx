import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Tv, Film, Eye, EyeOff, Plus, X, Star, WifiOff, Layers, Sliders, Check } from 'lucide-react';
import { getEventsFromIndexedDB } from '../utils/pwaHelper';
import MobileBottomSheet from '../components/MobileBottomSheet';

const pad = (num) => String(num).padStart(2, '0');

const groupDayEvents = (events) => {
  const grouped = [];
  const tvGroups = {}; // key: tmdbId-seasonNumber

  events.forEach(ev => {
    if (ev.type === 'movie') {
      grouped.push(ev);
    } else {
      const key = `${ev.tmdbId}-${ev.seasonNumber}`;
      if (!tvGroups[key]) {
        tvGroups[key] = [];
      }
      tvGroups[key].push(ev);
    }
  });

  Object.values(tvGroups).forEach(group => {
    if (group.length === 1) {
      grouped.push(group[0]);
    } else {
      // Sort episodes by episode number ascending
      group.sort((a, b) => a.episodeNumber - b.episodeNumber);

      const first = group[0];
      const last = group[group.length - 1];

      // Determine overall states for the group
      const isAllWatched = group.every(e => e.isWatched);
      const isAllCollected = group.every(e => e.isCollected);

      // Create a stacked event object
      grouped.push({
        ...first,
        isStacked: true,
        originalEpisodes: group,
        isWatched: isAllWatched,
        isCollected: isAllCollected,
        // S01E01-04 format
        episodeRangeText: `S${pad(first.seasonNumber)}E${pad(first.episodeNumber)}-${pad(last.episodeNumber)}`
      });
    }
  });

  return grouped;
};

const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('calendar_view_mode') || 'week'); // 'month' or 'week'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [expandedStacks, setExpandedStacks] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMobileDate, setSelectedMobileDate] = useState(new Date());
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const navigationRef = useRef(null);
  const lastScrollY = useRef(0);
  const currentTranslation = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const deltaY = currentScrollY - lastScrollY.current;

      let limitY = 0;
      if (isMobile) {
        limitY = navigationRef.current ? Math.max(0, navigationRef.current.offsetTop - 16) : 80;
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
  }, [isMobile]);

  useEffect(() => {
    currentTranslation.current = 0;
    if (containerRef.current) {
      containerRef.current.style.transform = 'translateY(0px)';
    }
  }, [isMobile]);

  useEffect(() => {
    const handleClose = () => {
      setIsDisplayMenuOpen(false);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  // Filtering & Toggles state
  const [hideCollected, setHideCollected] = useState(() => localStorage.getItem('calendar_hide_collected') === 'true');
  const [hideWatched, setHideWatched] = useState(() => localStorage.getItem('calendar_hide_watched') === 'true');

  const renderDisplayOptionsContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Layout</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'month' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'week' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Week
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Visibility</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                className="custom-checkbox-input"
                checked={hideCollected}
                onChange={() => setHideCollected(prev => !prev)}
              />
              <span className="custom-checkbox-box">
                <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
              </span>
              <span className="custom-checkbox-label">Hide Collected</span>
            </label>
            <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                className="custom-checkbox-input"
                checked={hideWatched}
                onChange={() => setHideWatched(prev => !prev)}
              />
              <span className="custom-checkbox-box">
                <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
              </span>
              <span className="custom-checkbox-label">Hide Watched</span>
            </label>
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
            <MobileBottomSheet title="Display Options" onClose={() => setIsDisplayMenuOpen(false)}>
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
              minWidth: '300px',
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleStackExpand = (id) => {
    setExpandedStacks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };



  const navigate = useNavigate();

  // Persistence hooks for viewMode and toggles
  useEffect(() => {
    localStorage.setItem('calendar_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('calendar_hide_collected', hideCollected);
  }, [hideCollected]);

  useEffect(() => {
    localStorage.setItem('calendar_hide_watched', hideWatched);
  }, [hideWatched]);

  // Auto-scroll to today's date in mobile view
  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const scrollTimer = setTimeout(() => {
          const todayEl = document.querySelector('.is-today');
          if (todayEl) {
            console.log('[PWA] Auto-scrolling mobile calendar view to current day.');
            todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        return () => clearTimeout(scrollTimer);
      }
    }
  }, [loading, viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => setIsOfflineMode(false);
    const goOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Fetch events based on current view date range
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        let start, end;
        if (viewMode === 'month') {
          // Fetch from 7 days before start of month to 7 days after to catch boundary cells
          const startMonth = startOfMonth(currentDate);
          const endMonth = endOfMonth(currentDate);
          const gridStart = startOfWeek(startMonth, { weekStartsOn: 1 });
          const gridEnd = endOfWeek(endMonth, { weekStartsOn: 1 });

          start = format(gridStart, 'yyyy-MM-dd');
          end = format(gridEnd, 'yyyy-MM-dd');
        } else {
          const gridStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          const gridEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

          start = format(gridStart, 'yyyy-MM-dd');
          end = format(gridEnd, 'yyyy-MM-dd');
        }

        try {
          const res = await api.get(`/calendar?start=${start}&end=${end}`);
          setEvents(res.data);
          setIsOfflineMode(false);
        } catch (netErr) {
          console.warn('[PWA] Failed to fetch calendar from network, falling back to IndexedDB:', netErr);
          setIsOfflineMode(true);
          const cached = await getEventsFromIndexedDB(start, end);
          if (cached && cached.length > 0) {
            setEvents(cached);
          } else {
            setEvents([]);
          }
        }
      } catch (err) {
        console.error('Failed in fetchEvents sequence:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [currentDate, viewMode]);

  const handleNavigate = (direction) => {
    if (viewMode === 'month') {
      setCurrentDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    }
  };

  const handleOpenDetails = (event) => {
    if (event.type === 'tv') {
      navigate(`/shows/${event.tmdbId}?season=${event.seasonNumber}`);
    } else {
      navigate(`/movies/${event.tmdbId}`);
    }
  };

  const handleToggleWatch = async (action, ev) => {
    const isTV = ev.type === 'tv';
    const isCurrentlyWatched = ev.isWatched;
    const newVal = !isCurrentlyWatched;

    try {
      if (isTV) {
        if (ev.isStacked) {
          await Promise.all(ev.originalEpisodes.map(subEv =>
            api.post('/media/episode/watch', {
              tmdbId: subEv.tmdbId,
              season: subEv.seasonNumber,
              episode: subEv.episodeNumber,
              watched: newVal,
              title: subEv.showTitle,
              posterPath: subEv.showPoster
            })
          ));
        } else {
          await api.post('/media/episode/watch', {
            tmdbId: ev.tmdbId,
            season: ev.seasonNumber,
            episode: ev.episodeNumber,
            watched: newVal,
            title: ev.showTitle,
            posterPath: ev.showPoster
          });
        }
      } else {
        await api.post('/media/watch', {
          tmdbId: ev.tmdbId,
          type: 'movie',
          title: ev.title,
          posterPath: ev.posterPath,
          remove: isCurrentlyWatched
        });
      }

      // Update local state
      const subIds = ev.isStacked ? ev.originalEpisodes.map(sub => sub.id) : [ev.id];
      setEvents(prev => prev.map(e => subIds.includes(e.id) ? { ...e, isWatched: newVal } : e));
    } catch (err) {
      console.error('Failed to toggle watch status:', err);
    }
  };

  const handleToggleCollect = async (action, ev) => {
    const isTV = ev.type === 'tv';
    const isCurrentlyCollected = ev.isCollected;
    const newVal = !isCurrentlyCollected;

    try {
      if (isTV) {
        if (ev.isStacked) {
          await Promise.all(ev.originalEpisodes.map(subEv =>
            api.post('/media/episode/collect', {
              tmdbId: subEv.tmdbId,
              season: subEv.seasonNumber,
              episode: subEv.episodeNumber,
              collected: newVal,
              title: subEv.showTitle,
              posterPath: subEv.showPoster
            })
          ));
        } else {
          await api.post('/media/episode/collect', {
            tmdbId: ev.tmdbId,
            season: ev.seasonNumber,
            episode: ev.episodeNumber,
            collected: newVal,
            title: ev.showTitle,
            posterPath: ev.showPoster
          });
        }
      } else {
        await api.post('/media/collect', {
          tmdbId: ev.tmdbId,
          type: 'movie',
          title: ev.title,
          posterPath: ev.posterPath,
          remove: isCurrentlyCollected
        });
      }

      // Update local state
      const subIds = ev.isStacked ? ev.originalEpisodes.map(sub => sub.id) : [ev.id];
      setEvents(prev => prev.map(e => subIds.includes(e.id) ? { ...e, isCollected: newVal } : e));
    } catch (err) {
      console.error('Failed to toggle collection status:', err);
    }
  };

  // Filter events based on active hide toggles and compute local timezone date/time
  const filteredEvents = events.filter(ev => {
    if (hideCollected && ev.isCollected) return false;
    if (hideWatched && ev.isWatched) return false;
    return true;
  }).map(ev => {
    if (ev.airDateTime) {
      const localDate = new Date(ev.airDateTime);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      const localTimeStr = localDate.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return {
        ...ev,
        localDateStr,
        localTimeStr
      };
    }

    return {
      ...ev,
      localDateStr: ev.airDate,
      localTimeStr: null
    };
  });

  // Construct calendar grid dates for Month View
  const getMonthDays = () => {
    const startM = startOfMonth(currentDate);
    const endM = endOfMonth(currentDate);

    // Grid starts at the Monday of the first week of the month
    const gridStart = startOfWeek(startM, { weekStartsOn: 1 });
    // Grid ends at the Sunday of the last week of the month
    const gridEnd = endOfWeek(endM, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  };

  // Construct dates for Week View (7 days starting Monday)
  const getWeekDays = () => {
    const gridStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  };

  const weekDaysHeader = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const renderEventCard = (ev) => {
    const isWatched = ev.isWatched;
    const poster = ev.type === 'tv' ? ev.showPoster : ev.posterPath;
    const title = ev.type === 'tv' ? ev.showTitle : ev.title;

    const totalCount = ev.isStacked ? ev.originalEpisodes.length : 1;
    const watchedCount = ev.isStacked ? ev.originalEpisodes.filter(e => e.isWatched).length : (ev.isWatched ? 1 : 0);
    const collectedCount = ev.isStacked ? ev.originalEpisodes.filter(e => e.isCollected).length : (ev.isCollected ? 1 : 0);

    // Button labels
    let collectLabel = 'Collect';
    if (ev.isStacked) {
      if (collectedCount === totalCount) {
        collectLabel = 'Collected All';
      } else if (collectedCount === 0) {
        collectLabel = 'Collect All';
      } else {
        collectLabel = `Collected ${collectedCount}/${totalCount}`;
      }
    } else {
      collectLabel = ev.isCollected ? 'Collected' : 'Collect';
    }

    let watchLabel = 'Watch';
    if (ev.isStacked) {
      if (watchedCount === totalCount) {
        watchLabel = 'Watched All';
      } else if (watchedCount === 0) {
        watchLabel = 'Watch All';
      } else {
        watchLabel = `Watched ${watchedCount}/${totalCount}`;
      }
    } else {
      watchLabel = ev.isWatched ? 'Watched' : 'Watch';
    }

    return (
      <div
        key={ev.id}
        className={`glass-panel ${ev.isStacked ? 'calendar-card-stacked' : ''}`}
        onClick={() => {
          if (ev.isStacked) {
            toggleStackExpand(ev.id);
          } else {
            handleOpenDetails(ev);
          }
        }}
        style={{
          padding: '10px',
          fontSize: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          cursor: 'pointer',
          background: isWatched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginRight: '0px',
          marginBottom: ev.isStacked ? '8px' : '0px',
          width: '100%',
          maxWidth: '100%',
          minWidth: '290px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', position: 'relative' }}>
          {poster ? (
            <img
              src={`https://image.tmdb.org/t/p/w185${poster}`}
              alt={title}
              style={{ width: '70px', borderRadius: '4px', aspectRatio: '2/3', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '60px', height: '90px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {ev.type === 'tv' ? <Tv size={20} /> : <Film size={20} />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, paddingRight: ev.isStacked ? '30px' : '0px' }}>
            <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </div>
            {ev.type === 'tv' ? (
              <div style={{ color: 'var(--accent)', fontWeight: '500', fontSize: '0.95rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}</span>
                {ev.localTimeStr && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>{ev.localTimeStr}</span>
                  </>
                )}
              </div>
            ) : (
              <div style={{ color: '#c084fc', fontWeight: '500', fontSize: '0.95rem', marginTop: '2px' }}>
                Movie Release
              </div>
            )}
          </div>
          {ev.isStacked && (
            <Layers size={14} style={{ color: 'var(--text-muted)', position: 'absolute', top: 0, right: 0 }} />
          )}
        </div>

        {ev.isStacked && expandedStacks[ev.id] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
            {ev.originalEpisodes.map(subEv => (
              <div key={subEv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => handleOpenDetails(subEv)}>
                  S{pad(subEv.seasonNumber)}E{pad(subEv.episodeNumber)}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleToggleCollect('collect', subEv)}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 6px',
                      fontSize: '0.8rem',
                      background: subEv.isCollected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: subEv.isCollected ? 'var(--success)' : 'var(--text-muted)'
                    }}
                  >
                    {subEv.isCollected ? 'Collected' : 'Collect'}
                  </button>
                  <button
                    onClick={() => handleToggleWatch('watch', subEv)}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 6px',
                      fontSize: '0.8rem',
                      background: subEv.isWatched ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: subEv.isWatched ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                  >
                    {subEv.isWatched ? 'Watched' : 'Watch'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleToggleCollect('collect', ev)}
            className="btn btn-secondary"
            style={{
              padding: '6px 8px',
              fontSize: '0.9rem',
              background: ev.isCollected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
              color: ev.isCollected ? 'var(--success)' : 'var(--text-muted)',
              flex: 1,
              justifyContent: 'center'
            }}
          >
            {collectLabel}
          </button>
          <button
            onClick={() => handleToggleWatch('watch', ev)}
            className="btn btn-secondary"
            style={{
              padding: '6px 8px',
              fontSize: '0.9rem',
              background: ev.isWatched ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
              color: ev.isWatched ? 'var(--accent)' : 'var(--text-muted)',
              flex: 1,
              justifyContent: 'center'
            }}
          >
            {watchLabel}
          </button>
        </div>
      </div>
    );
  };

  const selectedDateStr = format(selectedMobileDate, 'yyyy-MM-dd');
  const selectedDayEvents = filteredEvents.filter(e => e.localDateStr === selectedDateStr);

  return (
    <div style={{ width: '100%' }}>

      {/* Offline Mode PWA Banner */}
      {isOfflineMode && (
        <div className="pwa-offline-banner">
          <WifiOff size={20} />
          <span>Offline Mode — displaying local cached data for the next 6 months</span>
        </div>
      )}

      {/* Calendar Header Panel */}
      <div ref={containerRef} className="sticky-header-container">
        <div ref={headerRef} className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <CalendarIcon style={{ color: 'var(--accent)' }} size={28} />
            Calendar
          </h1>
          {renderDisplayOptions()}
        </div>

        {/* View Controls & Navigation */}
        <div ref={navigationRef} className="calendar-navigation-container">
          <h2 className="calendar-navigation-title">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy') : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
          </h2>
          <div className="calendar-navigation-controls">
            <button onClick={() => handleNavigate('prev')} className="nav-arrow-btn">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="nav-today-btn">
              Today
            </button>
            <button onClick={() => handleNavigate('next')} className="nav-arrow-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fetching-airtimes-notification">
          <div className="spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>Fetching airtimes...</span>
        </div>
      )}

      {/* -------------------- MONTH VIEW -------------------- */}
      {viewMode === 'month' && (
        isMobile ? (
          /* Mobile Month View: Full Screen Grid with Dots + Selected Day List */
          <div>
            <div className="mobile-calendar-grid">
              {weekDaysHeader.map(day => (
                <div key={day} className="mobile-calendar-header-day">{day.substring(0, 1)}</div>
              ))}
              {getMonthDays().map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = filteredEvents.filter(e => e.localDateStr === dateStr);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedMobileDate);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedMobileDate(day)}
                    className={`mobile-calendar-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
                  >
                    <span className="mobile-calendar-day-number">
                      {day.getDate()}
                    </span>
                    <div className="mobile-calendar-dots-row">
                      {dayEvents.slice(0, 4).map((ev, dIdx) => {
                        let dotClass = 'tv';
                        if (ev.isWatched) {
                          dotClass = 'watched';
                        } else if (ev.type === 'movie') {
                          dotClass = 'movie';
                        }
                        return (
                          <div key={ev.id || dIdx} className={`mobile-calendar-dot ${dotClass}`} />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Day Agenda view panel */}
            <div className="mobile-day-details-panel">
              <h3 className="mobile-day-details-title">
                Releases on {format(selectedMobileDate, 'EEEE, MMM d')}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 8px' }}>
                  No releases or airings scheduled for this day.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupDayEvents(selectedDayEvents).map(ev => renderEventCard(ev))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Month View */
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px' }}>
            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {weekDaysHeader.map(day => <div key={day}>{day}</div>)}
            </div>

            {/* Days grid */}
            <div className="calendar-month-grid">
              {getMonthDays().map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = filteredEvents.filter(e => e.localDateStr === dateStr);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <div
                    key={idx}
                    className={`calendar-month-day ${isToday ? 'is-today' : ''} ${dayEvents.length === 0 ? 'is-empty' : ''}`}
                    style={{ opacity: isCurrentMonth ? 1 : 0.35 }}
                  >
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: isToday ? '700' : '500',
                      color: isToday ? 'var(--accent)' : 'var(--text-main)',
                      alignSelf: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      {day.getDate()}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
                      {groupDayEvents(dayEvents).map(ev => {
                        const isWatched = ev.isWatched;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleOpenDetails(ev)}
                            style={{
                              padding: '4px 6px',
                              background: ev.type === 'tv'
                                ? (isWatched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.15)')
                                : 'rgba(167, 139, 250, 0.15)',
                              border: ev.type === 'tv'
                                ? (isWatched ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(59,130,246,0.2)')
                                : '1px solid rgba(167,139,250,0.2)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: ev.type === 'tv' ? (isWatched ? 'var(--success)' : '#60a5fa') : '#c084fc',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={ev.type === 'tv'
                              ? `${ev.localTimeStr ? `[${ev.localTimeStr}] ` : ''}${ev.showTitle} ${ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}`
                              : ev.title}
                          >
                            {ev.type === 'tv' ? <Tv size={10} /> : <Film size={10} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.type === 'tv' ? (
                                <>
                                  {ev.localTimeStr && <span style={{ color: 'var(--text-muted)', marginRight: '4px', fontSize: '0.7rem' }}>[{ev.localTimeStr}]</span>}
                                  {ev.showTitle} ({ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`})
                                </>
                              ) : ev.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* -------------------- WEEK VIEW -------------------- */}
      {viewMode === 'week' && (
        isMobile ? (
          /* Mobile Week View: Single Unified Agenda Feed with readable headers, empty days removed */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {getWeekDays().map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = filteredEvents.filter(e => e.localDateStr === dateStr);
              const isToday = isSameDay(day, new Date());

              // Agenda View: Hide empty days except if it's today
              if (dayEvents.length === 0 && !isToday) return null;

              return (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  {/* Clean readable header: Mon, 8th June */}
                  <div className={`mobile-agenda-day-header ${isToday ? 'is-today' : ''}`}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                      {format(day, 'EEE, do MMMM')}
                    </span>
                    {isToday && <span className="mobile-agenda-today-badge">Today</span>}
                  </div>

                  <div className="mobile-agenda-events-list">
                    {dayEvents.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '8px 12px' }}>
                        No Releases Scheduled
                      </div>
                    ) : (
                      groupDayEvents(dayEvents).map(ev => renderEventCard(ev))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Week View */
          <div className="calendar-week-grid">
            {getWeekDays().map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = filteredEvents.filter(e => e.localDateStr === dateStr);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={idx}
                  className={`calendar-week-column ${isToday ? 'is-today' : ''} ${dayEvents.length === 0 ? 'is-empty' : ''}`}
                >
                  {/* Column header */}
                  <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                      {weekDaysHeader[idx]}
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: isToday ? 'var(--accent)' : 'var(--text-main)',
                      marginTop: '4px',
                      display: 'inline-flex',
                      width: '32px',
                      height: '32px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background: isToday ? 'rgba(59, 130, 246, 0.2)' : 'transparent'
                    }}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Event listings inside column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    {dayEvents.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>
                        No Airings
                      </div>
                    ) : (
                      groupDayEvents(dayEvents).map(ev => renderEventCard(ev))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

    </div>
  );
};

export default CalendarView;

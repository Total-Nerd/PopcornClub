import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, isSameDay } from 'date-fns';

import { AuthContext } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import WatchOptionsModal from '../components/WatchOptionsModal';

import { useCalendarStore } from '../features/calendar/store/useCalendarStore';
import { groupDayEvents, pad } from '../features/calendar/utils';

import CalendarControls from '../features/calendar/components/CalendarControls';
import EventPopover from '../features/calendar/components/EventPopover';
import SwipeableEventCard from '../features/calendar/components/SwipeableEventCard';
import DesktopEventCard from '../features/calendar/components/DesktopEventCard';

const CalendarView = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const { showAlert } = useModal();
  const navigate = useNavigate();

  const [copiedId, setCopiedId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const [activePopover, setActivePopover] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const navigationRef = useRef(null);
  const lastScrollY = useRef(0);
  const currentTranslation = useRef(0);

  const store = useCalendarStore();
  const {
    events, loading, updatingInBackground,
    currentDate, setCurrentDate, navigateDate, viewMode,
    selectedMobileDate, setSelectedMobileDate,
    expandedStacks, toggleStackExpand,
    fetchEvents, toggleCollect, updateWatchStatus,
    hideCollected, hideWatched, mediaTypeFilter, showCopyButton, mobileSwipeMode
  } = store;

  // Track window resizing for mobile layout switching
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch data
  useEffect(() => {
    fetchEvents();
  }, [currentDate, viewMode]);

  // Handle scrolling behavior for sticky headers
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

  // Auto-scroll to today in mobile month view
  useEffect(() => {
    if (!loading && isMobile && viewMode === 'month' && typeof window !== 'undefined') {
      const scrollTimer = setTimeout(() => {
        const todayEl = document.querySelector('.is-today');
        if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(scrollTimer);
    }
  }, [loading, viewMode, isMobile]);

  // Copy helper
  const copyToClipboard = async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('Navigator clipboard failed, attempting fallback:', err);
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback clipboard copy failed:', fallbackErr);
      return false;
    }
  };

  const handleCopyText = (e, text, id) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    copyToClipboard(text);
    showAlert(`Copied "${text}" to clipboard`, 'success');
    if (id) {
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(prev => (prev === id ? null : prev));
      }, 2000);
    }
  };

  // Close popover listener
  useEffect(() => {
    const handleClosePopover = () => setActivePopover(null);
    window.addEventListener('click', handleClosePopover);
    return () => {
      window.removeEventListener('click', handleClosePopover);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleEventMouseEnter = (e, ev) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setActivePopover({ ev, rect });
    }, 2000);
  };

  const handleEventMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setActivePopover(null);
    }, 3000);
  };

  const handleEventContainerClick = (e, ev) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setActivePopover({ ev, rect });
  };

  const handleOpenDetails = (event) => {
    if (event.type === 'tv') {
      const epNum = event.isStacked ? event.originalEpisodes[0].episodeNumber : event.episodeNumber;
      navigate(`/shows/${event.tmdbId}?season=${event.seasonNumber}${epNum ? `&episode=${epNum}` : ''}`);
    } else {
      navigate(`/movies/${event.tmdbId}`);
    }
  };

  const handleToggleCollect = async (action, ev) => {
    const res = await toggleCollect(ev);
    if (res.success) {
      showAlert(`${res.newVal ? 'Collected' : 'Removed from collection'} "${res.title}"`, 'success');
    }
  };

  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [watchOptionsMedia, setWatchOptionsMedia] = useState(null);
  const [activeWatchEvent, setActiveWatchEvent] = useState(null);

  const handleToggleWatch = (action, ev) => {
    const isTV = ev.type === 'tv';
    setActiveWatchEvent(ev);
    const target = isTV && ev.isStacked ? ev.originalEpisodes[0] : ev;
    setWatchOptionsMedia({
      tmdbId: target.tmdbId,
      type: isTV ? 'episode' : 'movie',
      title: isTV ? `${target.showTitle} - S${pad(target.seasonNumber)}E${pad(target.episodeNumber)}` : target.title,
      overview: target.overview,
      releaseDate: isTV ? (target.airDateTime || target.airDate) : target.releaseDate,
      posterPath: isTV ? target.showPoster : target.posterPath,
      season: isTV ? target.seasonNumber : undefined,
      episode: isTV ? target.episodeNumber : undefined,
      grandparentTitle: isTV ? target.showTitle : undefined,
      parentTitle: isTV ? `Season ${target.seasonNumber}` : undefined,
      isWatched: ev.isWatched
    });
    setIsWatchOptionsOpen(true);
  };

  const handleWatchOptionsSelect = async ({ choice, watchedAt }) => {
    const res = await updateWatchStatus(choice, watchedAt, activeWatchEvent);
    if (res.success) {
      showAlert(res.message, res.type);
    } else {
      showAlert(res.message, res.type);
    }
  };

  // Filter Data
  const filteredEvents = events.filter(ev => {
    if (hideCollected && ev.isCollected) return false;
    if (hideWatched && ev.isWatched) return false;
    if (mediaTypeFilter === 'shows' && ev.type !== 'tv') return false;
    if (mediaTypeFilter === 'movies' && ev.type !== 'movie') return false;
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

      return { ...ev, localDateStr, localTimeStr };
    }
    return { ...ev, localDateStr: ev.airDate, localTimeStr: null };
  });

  const getMonthDays = () => {
    const { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } = require('date-fns');
    const startM = startOfMonth(currentDate);
    const endM = endOfMonth(currentDate);
    const gridStart = startOfWeek(startM, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endM, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  };

  const getWeekDays = () => {
    const { startOfWeek, endOfWeek, eachDayOfInterval } = require('date-fns');
    const gridStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  };

  const weekDaysHeader = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const selectedDateStr = format(selectedMobileDate, 'yyyy-MM-dd');
  const selectedDayEvents = filteredEvents.filter(e => e.localDateStr === selectedDateStr);

  const renderEventCard = (ev) => {
    if (isMobile && mobileSwipeMode) {
      return (
        <SwipeableEventCard
          key={ev.id}
          ev={ev}
          onToggleWatch={handleToggleWatch}
          onToggleCollect={handleToggleCollect}
          onOpenDetails={handleOpenDetails}
          onToggleStackExpand={toggleStackExpand}
          expandedStacks={expandedStacks}
          isAdmin={isAdmin}
          showCopyButton={showCopyButton}
          onCopyText={handleCopyText}
          copiedId={copiedId}
        />
      );
    }
    return (
      <DesktopEventCard
        key={ev.id}
        ev={ev}
        onToggleWatch={handleToggleWatch}
        onToggleCollect={handleToggleCollect}
        onOpenDetails={handleOpenDetails}
        onToggleStackExpand={toggleStackExpand}
        expandedStacks={expandedStacks}
        isAdmin={isAdmin}
        showCopyButton={showCopyButton}
        onCopyText={handleCopyText}
        copiedId={copiedId}
      />
    );
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Calendar Header Panel */}
      <div ref={containerRef} className="sticky-header-container">
        <div ref={headerRef} className="page-header">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <CalendarIcon style={{ color: 'var(--accent)' }} size={28} />
            Calendar
          </h1>
          <CalendarControls store={store} isAdmin={isAdmin} isMobile={isMobile} />
        </div>

        {/* View Controls & Navigation */}
        <div ref={navigationRef} className="calendar-navigation-container">
          <h2 className="calendar-navigation-title">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy') : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
          </h2>
          <div className="calendar-navigation-controls">
            <button onClick={() => navigateDate('prev')} className="nav-arrow-btn">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="nav-today-btn">
              Today
            </button>
            <button onClick={() => navigateDate('next')} className="nav-arrow-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {updatingInBackground && (
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
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '600px' }}>
            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {weekDaysHeader.map(day => <div key={day}>{day}</div>)}
            </div>

            {/* Days grid */}
            <div className="calendar-month-grid" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
                            onClick={(e) => handleEventContainerClick(e, ev)}
                            onMouseEnter={(e) => handleEventMouseEnter(e, ev)}
                            onMouseLeave={handleEventMouseLeave}
                            className="calendar-month-event"
                            style={{
                              padding: '4px 6px',
                              background: ev.type === 'tv'
                                ? (isWatched ? 'rgba(16, 185, 129, 0.1)' : (ev.isCollected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)'))
                                : 'rgba(167, 139, 250, 0.15)',
                              border: ev.type === 'tv'
                                ? (isWatched ? '1px solid rgba(16,185,129,0.2)' : (ev.isCollected ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255, 255, 255, 0.1)'))
                                : '1px solid rgba(167,139,250,0.2)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: ev.type === 'tv' ? (isWatched ? 'var(--success)' : (ev.isCollected ? '#60a5fa' : 'var(--text-main)')) : '#c084fc',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            <span 
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                setActivePopover(null);
                                handleOpenDetails(ev);
                              }}
                              className="actionable-text"
                            >
                              {ev.type === 'tv' ? (
                                <>
                                  {ev.localTimeStr && <span style={{ color: 'var(--text-muted)', marginRight: '4px', fontSize: '0.7rem' }}>[{ev.localTimeStr}]</span>}
                                  {ev.showTitle} ({ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`})
                                  {(ev.isStacked ? ev.originalEpisodes[0].episodeNumber : ev.episodeNumber) === 1 && ' ⭐'}
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
          /* Mobile Week View */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {getWeekDays().map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = filteredEvents.filter(e => e.localDateStr === dateStr);
              const isToday = isSameDay(day, new Date());

              // Hide empty days unless it's today
              if (dayEvents.length === 0 && !isToday) return null;

              return (
                <div key={idx} style={{ marginBottom: '16px' }}>
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
                <div key={idx} className={`calendar-week-column ${isToday ? 'is-today' : ''} ${dayEvents.length === 0 ? 'is-empty' : ''}`}>
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

      {isWatchOptionsOpen && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={watchOptionsMedia}
          onSelect={handleWatchOptionsSelect}
        />
      )}

      {viewMode === 'month' && activePopover && typeof window !== 'undefined' && (
        <EventPopover
          activePopover={activePopover}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={handleEventMouseLeave}
        >
          {renderEventCard(activePopover.ev)}
        </EventPopover>
      )}

      <style>{`
        .actionable-text {
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .actionable-text:hover {
          text-decoration: underline !important;
          color: var(--accent-light, #a78bfa) !important;
        }
        .actionable-poster {
          cursor: pointer;
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .actionable-poster:hover {
          filter: brightness(1.1) !important;
        }
        .actionable-poster:hover img {
          transform: scale(1.02);
        }
        .calendar-month-event {
          cursor: pointer;
          transition: filter 0.15s ease;
        }
        .calendar-month-event:hover {
          text-decoration: underline !important;
          filter: brightness(1.2) !important;
        }
        .calendar-copy-btn {
          opacity: 0.75;
          transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .calendar-copy-btn:hover {
          opacity: 1 !important;
          color: var(--text-main) !important;
          background: rgba(255, 255, 255, 0.08) !important;
          transform: scale(1.1);
        }
        .calendar-copy-btn:active {
          transform: scale(0.95);
        }
        .month-copy-btn:hover {
          background: rgba(255, 255, 255, 0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default CalendarView;

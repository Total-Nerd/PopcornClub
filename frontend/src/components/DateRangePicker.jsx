import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DateRangePicker = ({ startDate, endDate, onRangeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);
  const containerRef = useRef(null);

  // Helper: Format Date to YYYY-MM-DD
  const formatYMD = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper: Parse YYYY-MM-DD to Date object at local midnight
  const parseYMD = (str) => {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const startD = parseYMD(startDate);
  const endD = parseYMD(endDate);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Sync current month view when startD changes
  useEffect(() => {
    if (startD) {
      setCurrentMonth(new Date(startD.getFullYear(), startD.getMonth(), 1));
    }
  }, [startDate]);

  // Generate 42 days for the calendar grid
  const daysInGrid = (() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOfWeekDay = firstDay.getDay(); // 0: Sunday, 1: Monday, etc.
    
    const days = [];
    const date = new Date(year, month, 1);
    date.setDate(date.getDate() - startOfWeekDay); // rewind to Sunday
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  })();

  const handleDateClick = (date) => {
    const clicked = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (!startD || (startD && endD)) {
      // Start a new range
      onRangeChange(formatYMD(clicked), '');
    } else {
      // We have a startD but no endD
      if (clicked < startD) {
        // Clicked date is before start date, so make it the new start date
        onRangeChange(formatYMD(clicked), '');
      } else {
        // Set end date
        onRangeChange(formatYMD(startD), formatYMD(clicked));
        setIsOpen(false); // Auto close on select range
      }
    }
  };

  const setPreset = (presetType) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startVal = '';
    let endVal = '';

    if (presetType === 'today') {
      startVal = formatYMD(today);
      endVal = formatYMD(today);
    } else if (presetType === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      startVal = formatYMD(yesterday);
      endVal = formatYMD(yesterday);
    } else if (presetType === 'last7') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      startVal = formatYMD(start);
      endVal = formatYMD(today);
    } else if (presetType === 'last30') {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      startVal = formatYMD(start);
      endVal = formatYMD(today);
    } else if (presetType === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startVal = formatYMD(start);
      endVal = formatYMD(end);
    } else if (presetType === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      startVal = formatYMD(start);
      endVal = formatYMD(end);
    } else if (presetType === 'all') {
      startVal = '';
      endVal = '';
    }

    onRangeChange(startVal, endVal);
    setIsOpen(false);
  };

  const changeMonth = (offset) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  // Format label for button
  const getButtonLabel = () => {
    if (!startDate && !endDate) return 'All Time';
    
    const formatDateStr = (str) => {
      const d = parseYMD(str);
      if (!d) return '';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (startDate && !endDate) {
      return `${formatDateStr(startDate)} - Select end`;
    }
    if (startDate && endDate) {
      if (startDate === endDate) {
        return formatDateStr(startDate);
      }
      return `${formatDateStr(startDate)} - ${formatDateStr(endDate)}`;
    }
    return 'Select Date Range';
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const isSelectedStart = (date) => startD && isSameDay(date, startD);
  const isSelectedEnd = (date) => endD && isSameDay(date, endD);

  const isInRange = (date) => {
    if (!startD) return false;
    const dTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const startTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();

    if (endD) {
      const endTime = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime();
      return dTime >= startTime && dTime <= endTime;
    }

    if (hoveredDate) {
      const hoverTime = new Date(hoveredDate.getFullYear(), hoveredDate.getMonth(), hoveredDate.getDate()).getTime();
      if (hoverTime >= startTime) {
        return dTime >= startTime && dTime <= hoverTime;
      }
    }

    return false;
  };

  const isToday = (date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="date-range-picker-container" ref={containerRef} style={{ position: 'relative' }}>
      <div 
        className="date-range-btn" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          color: 'var(--text-main)',
          fontSize: '0.9rem',
          cursor: 'pointer',
          minWidth: '220px',
          transition: 'all 0.2s',
          height: '42px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Calendar size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.88rem' }}>{getButtonLabel()}</span>
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRangeChange('', '');
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              transition: 'background 0.2s'
            }}
            className="hover-bg"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div 
          className="date-range-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            background: 'var(--bg-card)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            overflow: 'hidden',
            animation: 'fadeInFilter 0.2s ease-out'
          }}
        >
          {/* Presets Sidebar */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
              borderRight: '1px solid var(--border-color)',
              gap: '6px',
              minWidth: '130px',
              background: 'rgba(0, 0, 0, 0.15)'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '8px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presets</span>
            <button onClick={() => setPreset('all')} className="preset-item-btn">All Time</button>
            <button onClick={() => setPreset('today')} className="preset-item-btn">Today</button>
            <button onClick={() => setPreset('yesterday')} className="preset-item-btn">Yesterday</button>
            <button onClick={() => setPreset('last7')} className="preset-item-btn">Last 7 Days</button>
            <button onClick={() => setPreset('last30')} className="preset-item-btn">Last 30 Days</button>
            <button onClick={() => setPreset('thisMonth')} className="preset-item-btn">This Month</button>
            <button onClick={() => setPreset('lastMonth')} className="preset-item-btn">Last Month</button>
          </div>

          {/* Calendar Grid */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', width: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button 
                onClick={() => changeMonth(-1)}
                style={{
                  background: 'var(--overlay-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '6px',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button 
                onClick={() => changeMonth(1)}
                style={{
                  background: 'var(--overlay-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '6px',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekdays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <span key={day} style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {daysInGrid.map((date, idx) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelStart = isSelectedStart(date);
                const isSelEnd = isSelectedEnd(date);
                const inRangeDay = isInRange(date);
                const todayDay = isToday(date);

                let dayBg = 'transparent';
                let dayColor = isCurrentMonth ? 'var(--text-main)' : 'var(--text-muted)';
                let opacity = isCurrentMonth ? 1 : 0.4;
                let borderRadius = '4px';

                if (isSelStart || isSelEnd) {
                  dayBg = 'var(--accent)';
                  dayColor = '#ffffff';
                  opacity = 1;
                } else if (inRangeDay) {
                  dayBg = 'rgba(59, 130, 246, 0.18)'; // 18% accent color for range highlighting
                  dayColor = 'var(--text-main)';
                  opacity = 1;
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateClick(date)}
                    onMouseEnter={() => !endD && setHoveredDate(date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    style={{
                      background: dayBg,
                      color: dayColor,
                      border: todayDay && !isSelStart && !isSelEnd ? '1px dashed var(--accent)' : 'none',
                      borderRadius: borderRadius,
                      padding: '6px 0',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      aspectRatio: '1',
                      opacity: opacity,
                      transition: 'all 0.15s'
                    }}
                    className="calendar-day-btn"
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .preset-item-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-item-btn:hover {
          background: var(--overlay-medium);
          color: var(--text-main);
        }
        .calendar-day-btn:hover {
          background: var(--overlay-strong);
          color: var(--text-main);
          opacity: 1;
        }
        .date-range-btn:hover {
          background: var(--overlay-medium) !important;
          border-color: var(--text-muted) !important;
        }
        .hover-bg:hover {
          background: var(--overlay-medium) !important;
          color: var(--text-main) !important;
        }
      `}</style>
    </div>
  );
};

export default DateRangePicker;

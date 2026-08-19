import React, { useState, useRef, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { useHistoryStore } from '../store/useHistoryStore';
import DateRangePicker from '../../../components/DateRangePicker';

const HistoryFilters = () => {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showWatchedWithDropdown, setShowWatchedWithDropdown] = useState(false);
  const watchedWithRef = useRef(null);

  const {
    searchQuery, setFilter, usersList, selectedUserId, coViewerUsers,
    watchedWithFilter, selectedGenre, availableGenres, startDate, endDate,
    type, includePartial, showPosters, resetFilters
  } = useHistoryStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (watchedWithRef.current && !watchedWithRef.current.contains(e.target)) {
        setShowWatchedWithDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="history-filter-panel">
      <div className="filter-grid">
        {/* Search Box */}
        <div className="filter-field">
          <label>Search Title</label>
          <input
            type="text"
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setFilter('searchQuery', e.target.value)}
            className="input-field"
            style={{ padding: '10px 14px', fontSize: '0.9rem' }}
          />
        </div>

        {/* User Filter (Admin only) */}
        {user?.role === 'admin' && (
          <div className="filter-field">
            <label>View History for User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setFilter('selectedUserId', e.target.value)}
              className="input-field"
              style={{ padding: '10px 14px', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              <option value="">Me ({user.username})</option>
              {usersList.map(u => {
                if (u.id === user.id) return null;
                return (
                  <option key={u.id} value={u.id}>
                    {u.name ? `${u.name} (${u.username})` : u.username}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Watched Together Filter */}
        {coViewerUsers.length > 0 && (
          <div className="filter-field" ref={watchedWithRef}>
            <label>Watched Together With (Exact Match)</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowWatchedWithDropdown(!showWatchedWithDropdown)}
                className="input-field"
                style={{
                  padding: '10px 14px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--overlay-medium)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <span>
                  {watchedWithFilter.length === 0 
                    ? 'Select Users...' 
                    : `${watchedWithFilter.length} User${watchedWithFilter.length > 1 ? 's' : ''} Selected`}
                </span>
                <span style={{ transform: showWatchedWithDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '0.75rem', opacity: 0.7 }}>▼</span>
              </button>
              
              {showWatchedWithDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 10,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {coViewerUsers.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '6px 8px', borderRadius: '4px', transition: 'background 0.2s' }} className="dropdown-item-hover">
                      <input
                        type="checkbox"
                        checked={watchedWithFilter.includes(u.id)}
                        onChange={(e) => {
                          let newFilter;
                          if (e.target.checked) {
                            newFilter = [...watchedWithFilter, u.id];
                          } else {
                            newFilter = watchedWithFilter.filter(id => id !== u.id);
                          }
                          setFilter('watchedWithFilter', newFilter);
                        }}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      {u.name ? `${u.name} (${u.username})` : u.username}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Genre Options */}
        <div className="filter-field">
          <label>Genre</label>
          <select
            value={selectedGenre}
            onChange={(e) => setFilter('selectedGenre', e.target.value)}
            className="input-field"
            style={{ padding: '10px 14px', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            <option value="">All Genres</option>
            {availableGenres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Date Range Picker */}
        <div className="filter-field">
          <label>Date Range</label>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(start, end) => {
              setFilter('startDate', start);
              setFilter('endDate', end);
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Media Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500', marginRight: '4px' }}>Type:</span>
            <button
              onClick={() => setFilter('type', 'all')}
              className={`filter-btn ${type === 'all' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('type', 'movie')}
              className={`filter-btn ${type === 'movie' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Movies
            </button>
            <button
              onClick={() => setFilter('type', 'tv')}
              className={`filter-btn ${type === 'tv' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Shows
            </button>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={includePartial}
                onChange={(e) => setFilter('includePartial', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              Show Partial
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={showPosters}
                onChange={(e) => setFilter('showPosters', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              Show Posters
            </label>
          </div>
        </div>

        <button
          onClick={() => resetFilters(setSearchParams)}
          style={{
            background: 'var(--overlay-medium)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          className="reset-btn-hover"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};

export default HistoryFilters;

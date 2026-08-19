import React from 'react';
import { useStatsStore } from '../store/useStatsStore';

const StatsFilters = () => {
  const { 
    mediaTypeFilter, setMediaTypeFilter, 
    timeRangeFilter, setTimeRangeFilter 
  } = useStatsStore();

  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        padding: '0 8px'
      }}
    >
      {/* Media type filter */}
      <div style={{ display: 'flex', background: 'var(--overlay-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {['all', 'shows', 'movies'].map(type => (
          <button
            key={type}
            onClick={() => setMediaTypeFilter(type)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: mediaTypeFilter === type ? 'var(--accent)' : 'transparent',
              color: mediaTypeFilter === type ? '#fff' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'capitalize'
            }}
          >
            {type === 'all' ? 'All Media' : type}
          </button>
        ))}
      </div>

      {/* Time range filter */}
      <div style={{ display: 'flex', background: 'var(--overlay-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {['week', 'month', 'range_year', 'all'].map(range => {
          const label = range === 'range_year' ? 'year' : range;
          const apiRange = range === 'range_year' ? 'year' : range;
          return (
            <button
              key={range}
              onClick={() => setTimeRangeFilter(apiRange)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: timeRangeFilter === apiRange ? 'var(--accent)' : 'transparent',
                color: timeRangeFilter === apiRange ? '#fff' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize'
              }}
            >
              {label === 'all' ? 'All Time' : `1 ${label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StatsFilters;

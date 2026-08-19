import React, { useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, SlidersHorizontal, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useHistoryStore } from '../features/history/store/useHistoryStore';

// Feature Components
import HistoryFilters from '../features/history/components/HistoryFilters';
import HistoryActiveSession from '../features/history/components/HistoryActiveSession';
import HistoryLogsList from '../features/history/components/HistoryLogsList';
import HistoryPagination from '../features/history/components/HistoryPagination';
import HistoryBulkActions from '../features/history/components/HistoryBulkActions';
import HistoryShareModal from '../features/history/components/HistoryShareModal';

const WatchHistory = () => {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const { 
    initFilters, fetchLogs, fetchShareableUsers, fetchCoViewers, fetchUsers,
    isFilterOpen, toggleFilterOpen,
    mediaIdFilter, tmdbIdFilter, mediaTitle, seasonFilter, episodeFilter,
    setFilter, page, type, includePartial, debouncedSearch, startDate, endDate, 
    selectedGenre, limit, selectedUserId, watchedWithFilter
  } = useHistoryStore();

  // Initialization
  useEffect(() => {
    initFilters(searchParams);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchShareableUsers();
  }, [fetchShareableUsers]);

  useEffect(() => {
    fetchCoViewers();
  }, [selectedUserId, fetchCoViewers]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  // Main data fetch on filter changes
  useEffect(() => {
    fetchLogs();
  }, [page, type, includePartial, debouncedSearch, startDate, endDate, selectedGenre, limit, mediaIdFilter, tmdbIdFilter, seasonFilter, episodeFilter, selectedUserId, watchedWithFilter, fetchLogs]);

  const clearMediaFilters = () => {
    setFilter('mediaIdFilter', '');
    setFilter('tmdbIdFilter', '');
    setFilter('mediaTitle', '');
    setSearchParams(prev => { 
      prev.delete('mediaId'); 
      prev.delete('tmdbId'); 
      prev.delete('title'); 
      return prev; 
    });
  };

  const clearSeasonFilters = () => {
    setFilter('seasonFilter', '');
    setFilter('episodeFilter', '');
    setSearchParams(prev => { 
      prev.delete('season'); 
      prev.delete('episode'); 
      return prev; 
    });
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <History size={32} style={{ color: 'var(--accent)' }} />
          <h1>Watch History</h1>
        </div>
        
        <button 
          onClick={toggleFilterOpen} 
          className={`filter-btn ${isFilterOpen ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <SlidersHorizontal size={18} />
          <span>Filters</span>
        </button>
      </div>
      
      {/* Active Filter Chips */}
      {(mediaIdFilter || tmdbIdFilter || seasonFilter || episodeFilter) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Filters:</span>
          {(mediaIdFilter || tmdbIdFilter) && (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
              {mediaTitle ? `Media: ${mediaTitle}` : `Specific Media ID: ${mediaIdFilter || tmdbIdFilter}`}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={clearMediaFilters} />
            </span>
          )}
          {(seasonFilter || episodeFilter) && (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
              {seasonFilter ? `Season ${seasonFilter}` : ''} {episodeFilter ? `Episode ${episodeFilter}` : ''}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={clearSeasonFilters} />
            </span>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {isFilterOpen && <HistoryFilters />}

      {/* Active Session (Currently Watching) */}
      <HistoryActiveSession />

      {/* Logs Table */}
      <HistoryLogsList />

      {/* Pagination */}
      <HistoryPagination />

      {/* Floating Action Bar for Bulk Selections */}
      <HistoryBulkActions />

      {/* Watched Together Modal */}
      <HistoryShareModal />

      <style>{`
        .hover-underline:hover {
          text-decoration: underline;
        }
        .hover-bg-danger:hover {
          background: rgba(239, 68, 68, 0.15);
          opacity: 1;
        }
        .reset-btn-hover:hover {
          background: var(--overlay-strong) !important;
        }
        @keyframes pulse-border {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WatchHistory;

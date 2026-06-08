import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { History, Trash2, Film, Tv, ChevronLeft, ChevronRight, Check, Play, SlidersHorizontal, X } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import { useModal } from '../context/ModalContext';
import DateRangePicker from '../components/DateRangePicker';

const WatchHistory = () => {
  const { showAlert, showConfirm } = useModal();

  const [logs, setLogs] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter States
  const [searchParams, setSearchParams] = useSearchParams();
  const initSearch = searchParams.get('search') || '';
  const initType = searchParams.get('type') || 'all';
  const initSeason = searchParams.get('season') || '';
  const initEpisode = searchParams.get('episode') || '';
  const initMediaId = searchParams.get('mediaId') || '';

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [type, setType] = useState(initType);
  const [searchQuery, setSearchQuery] = useState(initSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initSearch);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [includePartial, setIncludePartial] = useState(() => {
    const saved = localStorage.getItem('history_include_partial');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [mediaIdFilter, setMediaIdFilter] = useState(initMediaId);
  const [seasonFilter, setSeasonFilter] = useState(initSeason);
  const [episodeFilter, setEpisodeFilter] = useState(initEpisode);

  // Display Option
  const [showPosters, setShowPosters] = useState(() => {
    const saved = localStorage.getItem('history_show_posters');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('history_limit');
    return saved !== null ? parseInt(saved, 10) : 20;
  });
  const [pageInput, setPageInput] = useState(String(page));

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('history_include_partial', JSON.stringify(includePartial));
    setPage(1);
  }, [type, includePartial, debouncedSearch, startDate, endDate, selectedGenre, limit, mediaIdFilter, seasonFilter, episodeFilter]);

  useEffect(() => {
    localStorage.setItem('history_show_posters', JSON.stringify(showPosters));
  }, [showPosters]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const handlePageJumpSubmit = () => {
    let targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || targetPage < 1) {
      targetPage = 1;
    } else if (targetPage > totalPages) {
      targetPage = totalPages;
    }
    setPage(targetPage);
    setPageInput(String(targetPage));
  };

  const handlePageJumpKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePageJumpSubmit();
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media/watch-history', {
        params: {
          page,
          limit,
          type,
          includePartial,
          search: debouncedSearch,
          startDate,
          endDate,
          genre: selectedGenre,
          mediaId: mediaIdFilter || undefined,
          season: seasonFilter || undefined,
          episode: episodeFilter || undefined
        }
      });
      setLogs(res.data.logs);
      setAvailableGenres(res.data.genres || []);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch watch history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, type, includePartial, debouncedSearch, startDate, endDate, selectedGenre, limit, mediaIdFilter, seasonFilter, episodeFilter]);

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to delete this watch history entry?');
    if (!confirmed) return;
    try {
      await api.delete(`/media/watch-history/${id}`);
      showAlert('Watch history entry deleted successfully.', 'success');
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete history log:', err);
      showAlert('Failed to delete watch history log.', 'error');
    }
  };

  const formatDurationWithSeconds = (seconds) => {
    if (seconds === undefined || seconds === null || seconds <= 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleResetFilters = () => {
    setType('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedGenre('');
    setIncludePartial(true);
    setMediaIdFilter('');
    setSeasonFilter('');
    setEpisodeFilter('');
    setSearchParams({});
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <History size={32} style={{ color: 'var(--accent)' }} />
          <h1>Watch History</h1>
        </div>
        
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)} 
          className={`filter-btn ${isFilterOpen ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <SlidersHorizontal size={18} />
          <span>Filters</span>
        </button>
      </div>
      
      {/* Active Filter Chips */}
      {(mediaIdFilter || seasonFilter || episodeFilter) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Filters:</span>
          {mediaIdFilter && (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
              Specific Media ID: {mediaIdFilter}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => { setMediaIdFilter(''); setSearchParams(prev => { prev.delete('mediaId'); return prev; }); }} />
            </span>
          )}
          {(seasonFilter || episodeFilter) && (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
              {seasonFilter ? `Season ${seasonFilter}` : ''} {episodeFilter ? `Episode ${episodeFilter}` : ''}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => { setSeasonFilter(''); setEpisodeFilter(''); setSearchParams(prev => { prev.delete('season'); prev.delete('episode'); return prev; }); }} />
            </span>
          )}
        </div>
      )}

      {/* Filter Panel (Slide-down glass card) */}
      {isFilterOpen && (
        <div className="history-filter-panel">
          <div className="filter-grid">
            {/* Search Box */}
            <div className="filter-field">
              <label>Search Title</label>
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '10px 14px', fontSize: '0.9rem' }}
              />
            </div>

            {/* Genre Options */}
            <div className="filter-field">
              <label>Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
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
                  setStartDate(start);
                  setEndDate(end);
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
                  onClick={() => setType('all')}
                  className={`filter-btn ${type === 'all' ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  All
                </button>
                <button
                  onClick={() => setType('movie')}
                  className={`filter-btn ${type === 'movie' ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Movies
                </button>
                <button
                  onClick={() => setType('tv')}
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
                    onChange={(e) => setIncludePartial(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Show Partial
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
                  <input
                    type="checkbox"
                    checked={showPosters}
                    onChange={(e) => setShowPosters(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  Show Posters
                </label>
              </div>
            </div>

            <button
              onClick={handleResetFilters}
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
      )}

      {loading ? (
        <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeft: '4px solid var(--accent)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <History size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <p>No watch history matches found.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Media Info</th>
                  <th>Type</th>
                  <th>Watch Date & Time</th>
                  <th>Duration / Progress</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isMovie = log.type === 'movie';
                  const detailUrl = isMovie ? `/movies/${log.media.tmdbId}` : `/shows/${log.media.tmdbId}`;
                  const pct = log.duration > 0 ? Math.round((log.viewOffset / log.duration) * 100) : 0;

                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {showPosters && (
                            <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)' }}>
                              {log.media.posterPath ? (
                                <LazyImage
                                  src={`https://image.tmdb.org/t/p/w92${log.media.posterPath}`}
                                  alt={log.media.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                  {isMovie ? <Film size={18} /> : <Tv size={18} />}
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <Link to={detailUrl} style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.98rem' }} className="hover-underline">
                              {log.media.title}
                            </Link>
                            {!isMovie && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>
                                Season {log.season}, Episode {log.episode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {isMovie ? <Film size={14} /> : <Tv size={14} />}
                          {isMovie ? 'Movie' : 'TV Show'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {formatDateTime(log.watchedAt)}
                      </td>
                      <td>
                        {log.isCompleted ? (
                          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                            {formatDurationWithSeconds(log.duration)}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '150px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                              {formatDurationWithSeconds(log.viewOffset)} / {formatDurationWithSeconds(log.duration)} ({pct}%)
                            </span>
                            <div style={{ width: '100%', height: '6px', background: 'var(--overlay-medium)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {log.isCompleted ? (
                          <span className="badge badge-success">
                            <Check size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <Play size={12} />
                            Partial
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDelete(log.id)}
                          style={{
                            color: 'var(--danger)',
                            opacity: 0.8,
                            padding: '8px',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          className="hover-bg-danger"
                          title="Delete Watch Log"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Showing <strong>{totalCount === 0 ? 0 : (page - 1) * limit + 1}</strong> - <strong>{Math.min(page * limit, totalCount)}</strong> of <strong>{totalCount}</strong> entries
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>Show:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      const newLimit = parseInt(e.target.value, 10);
                      setLimit(newLimit);
                      localStorage.setItem('history_limit', newLimit);
                    }}
                    className="input-field"
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', background: 'var(--overlay-medium)', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '34px', boxSizing: 'border-box' }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={handlePageJumpKeyDown}
                    onBlur={handlePageJumpSubmit}
                    className="input-field"
                    style={{ width: '60px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'center', background: 'var(--overlay-medium)', border: '1px solid var(--border-color)', color: 'var(--text-main)', height: '34px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="pagination-btn"
                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px', boxSizing: 'border-box' }}
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="pagination-btn"
                    style={{ padding: '6px 12px', fontSize: '0.85rem', height: '34px', boxSizing: 'border-box' }}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
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
      `}</style>
    </div>
  );
};

export default WatchHistory;

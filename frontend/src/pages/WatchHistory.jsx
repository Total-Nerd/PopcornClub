import React, { useState, useEffect, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { History, Trash2, Film, Tv, ChevronLeft, ChevronRight, Check, Play, SlidersHorizontal, X, Users, UserPlus, UserMinus, Share2 } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import { useModal } from '../context/ModalContext';
import DateRangePicker from '../components/DateRangePicker';
import { AuthContext } from '../context/AuthContext';

const WatchHistory = () => {
  const { showAlert, showConfirm } = useModal();
  const { user } = useContext(AuthContext);

  const [logs, setLogs] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [activeSession, setActiveSession] = useState(null);

  // Bulk Selection & Shareable Users State
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [shareableUsers, setShareableUsers] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedTargetUserIds, setSelectedTargetUserIds] = useState([]);

  const [isSubmittingShare, setIsSubmittingShare] = useState(false);

  useEffect(() => {
    const fetchShareableUsers = async () => {
      try {
        const res = await api.get('/media/users/shareable');
        const list = Array.isArray(res.data) ? res.data : res.data?.users || [];
        setShareableUsers(list);
      } catch (err) {
        console.error('Failed to load shareable users:', err);
      }
    };
    fetchShareableUsers();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      const fetchUsers = async () => {
        try {
          const res = await api.get('/settings/users');
          setUsersList(res.data);
        } catch (err) {
          console.error('Failed to load users for history filtering:', err);
        }
      };
      fetchUsers();
    }
  }, [user]);

  // Filter States
  const [searchParams, setSearchParams] = useSearchParams();
  const initSearch = searchParams.get('search') || '';
  const initType = searchParams.get('type') || 'all';
  const initSeason = searchParams.get('season') || '';
  const initEpisode = searchParams.get('episode') || '';
  const initMediaId = searchParams.get('mediaId') || '';
  const initTmdbId = searchParams.get('tmdbId') || '';
  const initTitle = searchParams.get('title') || '';

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
  const [tmdbIdFilter, setTmdbIdFilter] = useState(initTmdbId);
  const [mediaTitle, setMediaTitle] = useState(initTitle);
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
  }, [type, includePartial, debouncedSearch, startDate, endDate, selectedGenre, limit, mediaIdFilter, tmdbIdFilter, seasonFilter, episodeFilter, selectedUserId]);

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
          tmdbId: tmdbIdFilter || undefined,
          season: seasonFilter || undefined,
          episode: episodeFilter || undefined,
          userId: selectedUserId || undefined
        }
      });
      setLogs(res.data.logs);
      setActiveSession(res.data.activeSession || null);
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
  }, [page, type, includePartial, debouncedSearch, startDate, endDate, selectedGenre, limit, mediaIdFilter, tmdbIdFilter, seasonFilter, episodeFilter, selectedUserId]);

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to delete this watch history entry?');
    if (!confirmed) return;
    try {
      await api.delete(`/media/watch-history/${id}`);
      showAlert('Watch history entry deleted successfully.', 'success');
      setSelectedLogIds(prev => prev.filter(item => item !== id));
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete history log:', err);
      showAlert('Failed to delete watch history log.', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLogIds.length === 0) return;
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedLogIds.length} selected watch history entry(ies)?`);
    if (!confirmed) return;
    try {
      await api.post('/media/watch-history/delete-bulk', { logIds: selectedLogIds });
      showAlert(`Successfully deleted ${selectedLogIds.length} watch history entry(ies).`, 'success');
      setSelectedLogIds([]);
      fetchLogs();
    } catch (err) {
      console.error('Failed bulk delete:', err);
      showAlert('Failed to delete selected watch history entries.', 'error');
    }
  };

  const handleOpenShareModal = (idsToShare = selectedLogIds) => {
    setSelectedLogIds(idsToShare);
    
    if (idsToShare.length === 1) {
      const log = logs.find(l => l.id === idsToShare[0]);
      if (log && log.watchedWithUsers) {
        setSelectedTargetUserIds(log.watchedWithUsers.map(u => u.id));
      } else {
        setSelectedTargetUserIds([]);
      }
    } else {
      setSelectedTargetUserIds([]);
    }
    
    setIsShareModalOpen(true);
  };

  const handleShareSubmit = async () => {
    setIsSubmittingShare(true);
    try {
      const usersToAdd = selectedTargetUserIds;
      const usersToRemove = shareableUsers.filter(u => !selectedTargetUserIds.includes(u.id)).map(u => u.id);
      
      const promises = [];
      
      if (usersToAdd.length > 0) {
        promises.push(api.post('/media/watch-history/share-bulk', {
          logIds: selectedLogIds,
          targetUserIds: usersToAdd
        }));
      }
      
      if (usersToRemove.length > 0) {
        promises.push(api.post('/media/watch-history/unshare-bulk', {
          logIds: selectedLogIds,
          targetUserIds: usersToRemove
        }));
      }
      
      await Promise.all(promises);
      
      showAlert(`Successfully updated watch history sharing for ${selectedLogIds.length} item(s)!`, 'success');
      setIsShareModalOpen(false);
      setSelectedLogIds([]);
      setSelectedTargetUserIds([]);
      fetchLogs();
    } catch (err) {
      console.error('Failed to execute watch history share action:', err);
      showAlert('Failed to update shared watch history.', 'error');
    } finally {
      setIsSubmittingShare(false);
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
    setTmdbIdFilter('');
    setMediaTitle('');
    setSeasonFilter('');
    setEpisodeFilter('');
    setSelectedUserId('');
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
      {(mediaIdFilter || tmdbIdFilter || seasonFilter || episodeFilter) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Filters:</span>
          {(mediaIdFilter || tmdbIdFilter) && (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
              {mediaTitle ? `Media: ${mediaTitle}` : `Specific Media ID: ${mediaIdFilter || tmdbIdFilter}`}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => { setMediaIdFilter(''); setTmdbIdFilter(''); setMediaTitle(''); setSearchParams(prev => { prev.delete('mediaId'); prev.delete('tmdbId'); prev.delete('title'); return prev; }); }} />
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

            {/* User Filter (Admin only) */}
            {user?.role === 'admin' && (
              <div className="filter-field">
                <label>View History for User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
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

      {/* Active Session (Currently Watching) */}
      {activeSession && (
        <div 
          className="glass-panel" 
          style={{ 
            marginBottom: '20px', 
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(124, 58, 237, 0.03) 100%)', 
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.05)',
            borderRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Pulsing indicator */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
              <div style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--danger)', opacity: 0.4, animation: 'pulse-border 2s infinite ease-in-out' }} />
            </div>

            {/* Poster preview */}
            {showPosters && activeSession.posterPath && (
              <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                <LazyImage
                  src={`https://image.tmdb.org/t/p/w92${activeSession.posterPath}`}
                  alt={activeSession.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                  Currently Watching
                </span>
                {activeSession.user && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({activeSession.user})
                  </span>
                )}
              </div>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                {activeSession.type === 'episode' ? activeSession.grandparentTitle : activeSession.title}
              </span>
              {activeSession.type === 'episode' && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  S{activeSession.season}E{activeSession.episode} — "{activeSession.title}"
                </div>
              )}
            </div>
          </div>

          {/* Progress details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px', flex: '1 1 200px', maxWidth: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              <span>{formatDurationWithSeconds(Math.round(activeSession.viewOffset / 1000))}</span>
              <span>{formatDurationWithSeconds(Math.round(activeSession.duration / 1000))} ({activeSession.duration > 0 ? Math.round((activeSession.viewOffset / activeSession.duration) * 100) : 0}%)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--overlay-medium)', borderRadius: '3px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${activeSession.duration > 0 ? Math.round((activeSession.viewOffset / activeSession.duration) * 100) : 0}%`, 
                  height: '100%', 
                  background: 'var(--danger)', 
                  borderRadius: '3px' 
                }} 
              />
            </div>
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
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={logs.length > 0 && selectedLogIds.length === logs.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLogIds(logs.map(l => l.id));
                        } else {
                          setSelectedLogIds([]);
                        }
                      }}
                      style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--accent)' }}
                      title="Select All On Page"
                    />
                  </th>
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
                  const isSelected = selectedLogIds.includes(log.id);

                  return (
                    <tr key={log.id} style={{ background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLogIds(prev => [...prev, log.id]);
                            } else {
                              setSelectedLogIds(prev => prev.filter(id => id !== log.id));
                            }
                          }}
                          style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--accent)' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {showPosters && (
                            <Link to={detailUrl} style={{ display: 'block', width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', textDecoration: 'none' }}>
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
                            </Link>
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
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenShareModal([log.id])}
                            style={{
                              color: 'var(--accent)',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                            title={
                              log.watchedWithUsers && log.watchedWithUsers.length > 0
                                ? `Watched with ${log.watchedWithUsers.map(u => u.name || u.username).join(', ')}`
                                : "Watched Together / Share"
                            }
                          >
                            <Users size={15} />
                            <span>Together</span>
                            {log.watchedWithUsers && log.watchedWithUsers.length > 0 && (
                              <div style={{ display: 'flex', marginLeft: '4px', gap: '2px', alignItems: 'center' }}>
                                {log.watchedWithUsers.map(u => (
                                  <div
                                    key={u.id}
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '50%',
                                      background: 'var(--accent)',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.68rem',
                                      fontWeight: '700',
                                      border: '1.5px solid var(--panel-bg)'
                                    }}
                                  >
                                    {u.avatarPath ? (
                                      <img
                                        src={u.avatarPath}
                                        alt={u.username}
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          if (e.currentTarget.parentElement) {
                                            e.currentTarget.parentElement.innerText = u.username.substring(0, 2).toUpperCase();
                                          }
                                        }}
                                        style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                      />
                                    ) : (
                                      u.username.substring(0, 2).toUpperCase()
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            style={{
                              color: 'var(--danger)',
                              opacity: 0.8,
                              padding: '6px 8px',
                              borderRadius: '6px',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              border: 'none',
                              background: 'transparent'
                            }}
                            className="hover-bg-danger"
                            title="Delete Watch Log"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Floating Action Bar for Bulk Selections */}
          {selectedLogIds.length > 0 && (
            <div style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999,
              background: 'rgba(20, 24, 33, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)'
            }}>
              <span style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                {selectedLogIds.length} item{selectedLogIds.length > 1 ? 's' : ''} selected
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleOpenShareModal(selectedLogIds)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Users size={16} />
                  Watched Together
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="btn btn-danger"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--danger)' }}
                >
                  <Trash2 size={16} />
                  Delete Selected
                </button>

                <button
                  onClick={() => setSelectedLogIds([])}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}
                  title="Deselect All"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

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
      {/* Watched Together Modal */}
      {isShareModalOpen && (
        <div className="custom-modal-backdrop" onClick={() => setIsShareModalOpen(false)}>
          <div className="custom-modal-content" style={{ maxWidth: '520px', width: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={22} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Watched Together</h3>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Apply watch history updates for <strong>{selectedLogIds.length} item{selectedLogIds.length > 1 ? 's' : ''}</strong>:
              </p>

              {/* Removed Add/Remove toggle as per user request */}

              {/* Target User List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {shareableUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No other user accounts found to share with.
                  </div>
                ) : (
                  shareableUsers.map(u => {
                    const isChecked = selectedTargetUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--overlay-subtle)',
                          border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden' }}>
                            {u.avatarPath ? (
                              <img src={u.avatarPath} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            ) : null}
                            <span style={{ display: u.avatarPath ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                              {u.username.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              {u.name || u.username}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              @{u.username}
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargetUserIds(prev => [...prev, u.id]);
                            } else {
                              setSelectedTargetUserIds(prev => prev.filter(id => id !== u.id));
                            }
                          }}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="custom-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px' }}>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShareSubmit}
                disabled={isSubmittingShare}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.88rem', background: 'var(--accent)' }}
              >
                {isSubmittingShare ? 'Updating...' : 'Update / Save'}
              </button>
            </div>
          </div>
        </div>
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

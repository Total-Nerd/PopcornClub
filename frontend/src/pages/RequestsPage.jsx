import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getRequests, cancelRequest, updateRequestStatus, createRequest } from '../api/requests';
import { useModal } from '../context/ModalContext';
import { Check, X, Trash2, Archive, Loader, AlertTriangle, Film, Tv, Clock, RotateCcw, Plus, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import LazyImage from '../components/LazyImage';

const RequestsPage = () => {
  const { user } = useContext(AuthContext);
  const { showConfirm, showAlert } = useModal();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(['pending', 'confirmed']);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingRequestIds, setRejectingRequestIds] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [autoReject, setAutoReject] = useState(false);
  const [sortBy, setSortBy] = useState('requestDate');
  const [sortOrder, setSortOrder] = useState('desc');

  const STATUS_ORDER = {
    pending: 1,
    confirmed: 2,
    collected: 3,
    rejected: 4
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      showAlert('Failed to load requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCancel = async (ids) => {
    const confirmed = await showConfirm('Are you sure you want to cancel this request?');
    if (confirmed) {
      try {
        await Promise.all(ids.map(id => cancelRequest(id)));
        setRequests(prev => prev.filter(r => !ids.includes(r.id)));
      } catch (err) {
        showAlert('Failed to cancel request.', 'error');
      }
    }
  };

  const handleUpdateStatus = async (ids, status, extraData = {}) => {
    try {
      const updatedArray = await Promise.all(ids.map(id => updateRequestStatus(id, { status, ...extraData })));
      setRequests(prev => prev.map(r => {
        const updated = updatedArray.find(u => u.id === r.id);
        if (updated) {
          return { ...r, status: updated.status, rejectReason: updated.rejectReason, autoReject: updated.autoReject };
        }
        return r;
      }));
      return true;
    } catch (err) {
      showAlert('Failed to update request status.', 'error');
      return false;
    }
  };

  const openRejectModal = (ids) => {
    setRejectingRequestIds(ids);
    setRejectReason('');
    setAutoReject(false);
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectingRequestIds) return;
    const success = await handleUpdateStatus(rejectingRequestIds, 'rejected', { rejectReason, autoReject });
    if (success) {
      setRejectModalOpen(false);
      setRejectingRequestIds(null);
    }
  };

  const handleIWantThis = async (media, season, episode) => {
    try {
      const newReq = await createRequest({ 
        tmdbId: media.tmdbId, 
        type: media.type, 
        title: media.title, 
        season, 
        episode 
      });
      setRequests(prev => [newReq, ...prev]);
      showAlert('You have been added to the request.', 'success');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        showAlert(err.response.data.error, 'error');
      } else {
        showAlert('Failed to add you to the request.', 'error');
      }
    }
  };

  const toggleFilter = (status) => {
    setActiveFilters(prev => 
      prev.includes(status) 
        ? prev.filter(f => f !== status)
        : [...prev, status]
    );
  };

  const groupRequests = (reqs) => {
    const grouped = {};
    reqs.forEach(req => {
      const key = `${req.mediaId}-${req.season || 'X'}-${req.episode || 'X'}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...req,
          allIds: [req.id],
          users: [req.user],
          userIds: [req.userId]
        };
      } else {
        grouped[key].allIds.push(req.id);
        if (!grouped[key].userIds.includes(req.userId)) {
          grouped[key].users.push(req.user);
          grouped[key].userIds.push(req.userId);
        }
        // If there's a mix of statuses, prioritize: collected > confirmed > pending > rejected
        const statusPriority = { collected: 4, confirmed: 3, pending: 2, rejected: 1 };
        const currentPriority = statusPriority[grouped[key].status] || 0;
        const newPriority = statusPriority[req.status] || 0;
        if (newPriority > currentPriority) {
          grouped[key].status = req.status;
        }
      }
    });
    return Object.values(grouped);
  };

  const groupedRequests = groupRequests(requests);

  const filteredRequests = groupedRequests
    .filter(r => activeFilters.includes(r.status))
    .sort((a, b) => {
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (sortBy === 'title') {
        return getRequestTitle(a).localeCompare(getRequestTitle(b)) * modifier;
      } else if (sortBy === 'releaseDate') {
        const dateA = a.media.releaseDate ? new Date(a.media.releaseDate).getTime() : 0;
        const dateB = b.media.releaseDate ? new Date(b.media.releaseDate).getTime() : 0;
        return (dateA - dateB) * modifier;
      } else if (sortBy === 'requestDate') {
        return (new Date(a.createdAt) - new Date(b.createdAt)) * modifier;
      } else if (sortBy === 'type') {
        return a.media.type.localeCompare(b.media.type) * modifier;
      } else {
        // default: status
        const aOrder = STATUS_ORDER[a.status] || 99;
        const bOrder = STATUS_ORDER[b.status] || 99;
        if (aOrder !== bOrder) return (aOrder - bOrder) * modifier;
        return (new Date(a.createdAt) - new Date(b.createdAt)) * modifier;
      }
    });

  const getRequestTitle = (req) => {
    if (req.media.type === 'movie') return req.media.title;
    if (req.season && req.episode) return `${req.media.title} - S${req.season}E${req.episode}`;
    if (req.season) return `${req.media.title} - Season ${req.season}`;
    return req.media.title;
  };

  const QUICK_REASONS = [
    "Unable to find",
    "Not available in good quality",
    "Already requested",
    "Does not fit server criteria"
  ];

  return (
    <div style={{ padding: '32px 24px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>Media Requests</h1>
        </div>
      </div>

      <style>{`
        .avatar-tooltip-container {
          position: relative;
          cursor: pointer;
        }
        .avatar-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 120%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.85);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          white-space: nowrap;
          z-index: 10;
          transition: opacity 0.2s, visibility 0.2s;
          pointer-events: none;
        }
        .avatar-tooltip-container:hover .avatar-tooltip {
          visibility: visible;
          opacity: 1;
        }
      `}</style>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', overflowX: 'auto' }}>
        {['pending', 'confirmed', 'collected', 'rejected'].map(tab => {
          const isActive = activeFilters.includes(tab);
          return (
            <button
              key={tab}
              onClick={() => toggleFilter(tab)}
              className="btn"
              style={{ 
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                textTransform: 'capitalize',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                padding: '8px 16px',
                borderRadius: '8px'
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <p>No requests found for the selected filters.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                {/* Reusable Header Renderer */}
                {[
                  { key: 'title', label: 'Media' },
                  { key: 'type', label: 'Type' },
                  { key: 'releaseDate', label: 'Release Date' },
                  { key: 'status', label: 'Status / Reason' },
                  { key: 'requestDate', label: 'Request Date' }
                ].map(col => (
                  <th 
                    key={col.key} 
                    style={{ padding: '16px', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => {
                      if (sortBy === col.key) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy(col.key);
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {col.label}
                      {sortBy === col.key ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowDown size={14} style={{ opacity: 0.2 }} />
                      )}
                    </div>
                  </th>
                ))}
                
                <th style={{ padding: '16px', fontWeight: '600' }}>Requested By</th>
                {user?.role === 'admin' && (
                  <th style={{ padding: '16px', fontWeight: '600' }}>IMDb</th>
                )}
                <th style={{ padding: '16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const targetUrl = `/${req.media.type === 'movie' ? 'movie' : 'show'}s/${req.media.tmdbId}`;
                const userReqId = requests.find(r => r.userId === user?.id && r.mediaId === req.mediaId && r.season === req.season && r.episode === req.episode)?.id;
                const isUserRequest = !!userReqId;

                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Link to={targetUrl} style={{ display: 'block', width: '45px', height: '68px', flexShrink: 0, background: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', textDecoration: 'none' }}>
                          {req.media.posterPath ? (
                            <LazyImage 
                              src={`https://image.tmdb.org/t/p/w92${req.media.posterPath}`}
                              alt={req.media.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--text-muted)' }}>No Cover</div>
                          )}
                        </Link>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Link to={targetUrl} className="hover-underline" style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px', textDecoration: 'none' }} title={getRequestTitle(req)}>
                              {getRequestTitle(req)}
                            </Link>
                            {user?.role === 'admin' && (
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigator.clipboard.writeText(getRequestTitle(req));
                                  showAlert('Copied title to clipboard', 'success');
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '4px' }}
                                title="Copy Title"
                              >
                                <Copy size={14} />
                              </button>
                            )}
                          </div>
                          {req.media.type === 'tv' && !req.episode && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '4px' }}>
                              Collected Episodes: {req.collectedCount || 0}/{req.totalEpisodes || '?'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {req.media.type === 'movie' ? <Film size={14} /> : <Tv size={14} />}
                        {req.media.type === 'movie' ? 'Movie' : 'TV Show'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {req.media.releaseDate ? new Date(req.media.releaseDate).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={`badge ${
                          req.status === 'pending' ? 'badge-warning' : 
                          req.status === 'confirmed' ? 'badge-info' : 
                          req.status === 'collected' ? 'badge-success' : 
                          'badge-danger'
                        }`}>
                          {req.status === 'pending' && <Clock size={12} />}
                          {req.status === 'confirmed' && <Check size={12} />}
                          {req.status === 'collected' && <Archive size={12} />}
                          {req.status === 'rejected' && <X size={12} />}
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                        {req.status === 'rejected' && req.rejectReason && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>
                            Reason: {req.rejectReason}
                          </div>
                        )}
                        {req.status === 'rejected' && req.autoReject && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> Auto-Reject enabled
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {req.users.map(u => (
                          <div key={u.id} className="avatar-tooltip-container">
                            {u.avatarPath ? (
                              <img src={u.avatarPath} alt={u.username} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--panel-bg)' }} />
                            ) : (
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#fff', border: '2px solid var(--panel-bg)' }}>
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="avatar-tooltip">{u.username}</div>
                          </div>
                        ))}
                        
                        {!isUserRequest && req.status !== 'rejected' && req.status !== 'collected' && (
                          <button 
                            onClick={() => handleIWantThis(req.media, req.season, req.episode)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.75rem', 
                              borderRadius: '12px', 
                              background: 'rgba(255,255,255,0.05)', 
                              marginLeft: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Plus size={12} />
                            I want this
                          </button>
                        )}
                      </div>
                    </td>
                    {user?.role === 'admin' && (
                      <td style={{ padding: '12px 16px' }}>
                        {req.imdbId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a href={`https://www.imdb.com/title/${req.imdbId}`} target="_blank" rel="noopener noreferrer" className="hover-underline" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                              {req.imdbId}
                            </a>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(req.imdbId);
                                showAlert('Copied IMDb code to clipboard', 'success');
                              }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                              title="Copy IMDb ID"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {(isUserRequest || user?.role === 'admin') && (req.status === 'pending' || req.status === 'collected') && (
                          <button 
                            onClick={() => {
                              if (user?.role === 'admin') {
                                handleCancel(req.allIds);
                              } else {
                                handleCancel([userReqId]);
                              }
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', color: '#f87171', background: 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={user?.role === 'admin' ? "Delete Request for ALL users (Remove permanently)" : "Delete your request"}
                          >
                            <Trash2 size={14} />
                            <span style={{ fontSize: '0.8rem' }}>Delete</span>
                          </button>
                        )}

                        {user?.role === 'admin' && (
                          <>
                            {req.status === 'pending' && (
                              <button 
                                onClick={() => handleUpdateStatus(req.allIds, 'confirmed')}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', color: '#60a5fa', background: 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Confirm Request for ALL users"
                              >
                                <Check size={14} />
                                <span style={{ fontSize: '0.8rem' }}>Confirm</span>
                              </button>
                            )}
                            {(req.status === 'pending' || req.status === 'confirmed') && (
                              <button 
                                onClick={() => openRejectModal(req.allIds)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', color: '#f87171', background: 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Reject Request for ALL users"
                              >
                                <X size={14} />
                                <span style={{ fontSize: '0.8rem' }}>Reject</span>
                              </button>
                            )}
                            {req.status === 'rejected' && (
                              <button 
                                onClick={() => handleUpdateStatus(req.allIds, 'pending', { rejectReason: null, autoReject: false })}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', color: '#fbbf24', background: 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Restore ALL users to Pending"
                              >
                                <RotateCcw size={14} />
                                <span style={{ fontSize: '0.8rem' }}>Restore</span>
                              </button>
                            )}
                            {req.status !== 'collected' && (
                              <button 
                                onClick={() => handleUpdateStatus(req.allIds, 'collected')}
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', color: 'var(--text-main)', background: 'rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Mark ALL as Collected"
                              >
                                <Archive size={14} />
                                <span style={{ fontSize: '0.8rem' }}>Collect</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }} onClick={() => setRejectModalOpen(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', background: 'var(--panel-bg)', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Reject Request</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>Reason (Optional)</label>
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this request being rejected?"
                style={{ width: '100%', minHeight: '80px', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {QUICK_REASONS.map((reason, idx) => (
                <button
                  key={idx}
                  onClick={() => setRejectReason(reason)}
                  className="btn btn-secondary"
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '6px 12px', 
                    background: 'rgba(255,255,255,0.1)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '20px' 
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoReject}
                onChange={(e) => setAutoReject(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--danger)' }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Globally Auto-Reject future requests for this item</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                onClick={submitReject}
                className="btn btn-primary"
                style={{ padding: '8px 16px', background: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;

import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Calendar, Check, Trash2, List } from 'lucide-react';
import MobileBottomSheet from './MobileBottomSheet';
import api from '../api';

const WatchOptionsModal = ({ isOpen, onClose, media, onSelect, onWatchStatusChange }) => {
  const getLocalDateTimeString = () => {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedDate, setSelectedDate] = useState(getLocalDateTimeString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = async () => {
    if (!media) return;
    setLoadingHistory(true);
    try {
      const res = await api.get('/media/watch-history', {
        params: {
          tmdbId: media.tmdbId,
          type: media.type,
          season: media.season,
          episode: media.episode,
          limit: 100
        }
      });
      setHistoryLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch watch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(getLocalDateTimeString());
      if (media?.isWatched) {
        fetchHistory();
      }
    } else {
      setHistoryLogs([]);
      setShowHistory(false);
    }
  }, [isOpen, media]);

  if (!isOpen) return null;

  const handleOption = (choice, watchedAt = null) => {
    onSelect({ choice, watchedAt });
    onClose();
  };

  const handleRemoveLast = async () => {
    try {
      const res = await api.post('/media/watch-history/remove-last', {
        tmdbId: media.tmdbId,
        type: media.type,
        season: media.season,
        episode: media.episode
      });
      if (res.data.success) {
        if (onWatchStatusChange) {
          onWatchStatusChange(res.data.isWatched);
        }
        onSelect({ choice: 'removed-last', watchedAt: res.data.isWatched });
        onClose();
      }
    } catch (err) {
      console.error('Failed to remove last watch history:', err);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      const res = await api.delete(`/media/watch-history/${logId}`);
      if (res.data.success) {
        await fetchHistory();
        if (onWatchStatusChange) {
          onWatchStatusChange(res.data.isWatched);
        }
      }
    } catch (err) {
      console.error('Failed to delete specific watch log:', err);
    }
  };

  const handleOtherTimeSubmit = (e) => {
    e.preventDefault();
    if (!selectedDate) return;
    const dateObj = new Date(selectedDate);
    handleOption('other-time', dateObj.toISOString());
  };

  // Format release date for display
  const releaseDateVal = media?.releaseDate || media?.air_date || media?.airDateTime;
  const formattedReleaseDate = releaseDateVal ? new Date(releaseDateVal).toLocaleDateString() : '';

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button
        type="button"
        className="mobile-sheet-option"
        onClick={() => handleOption('watching-now')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '14px',
          textAlign: 'left',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          fontSize: '0.95rem',
          width: '100%',
          marginBottom: '0px'
        }}
      >
        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          color: 'var(--accent)',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Play size={18} fill="currentColor" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: '600' }}>Watching Now</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show floating progress & track duration</span>
        </div>
      </button>

      <button
        type="button"
        className="mobile-sheet-option"
        onClick={() => handleOption('just-watched', new Date().toISOString())}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '14px',
          textAlign: 'left',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          fontSize: '0.95rem',
          width: '100%',
          marginBottom: '0px'
        }}
      >
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success)',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Clock size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: '600' }}>Just Watched</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mark as watched right now</span>
        </div>
      </button>

      {releaseDateVal && (
        <button
          type="button"
          className="mobile-sheet-option"
          onClick={() => handleOption('release-date', new Date(releaseDateVal).toISOString())}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '14px',
            textAlign: 'left',
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'var(--overlay-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            width: '100%',
            marginBottom: '0px'
          }}
        >
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: 'var(--warning)',
            borderRadius: '50%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: '600' }}>Release Date</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set date to release ({formattedReleaseDate})</span>
          </div>
        </button>
      )}

      <button
        type="button"
        className={`mobile-sheet-option ${showDatePicker ? 'active' : ''}`}
        onClick={() => setShowDatePicker(!showDatePicker)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '14px',
          textAlign: 'left',
          padding: '14px 18px',
          borderRadius: '12px',
          background: showDatePicker ? 'var(--overlay-medium)' : 'var(--overlay-subtle)',
          border: '1px solid ' + (showDatePicker ? 'var(--accent)' : 'var(--border-color)'),
          color: 'var(--text-main)',
          cursor: 'pointer',
          fontSize: '0.95rem',
          width: '100%',
          marginBottom: '0px'
        }}
      >
        <div style={{
          background: 'rgba(192, 132, 252, 0.15)',
          color: '#c084fc',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Clock size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <span style={{ fontWeight: '600' }}>Other Time</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose custom past date/time</span>
        </div>
      </button>

      {showDatePicker && (
        <form onSubmit={handleOtherTimeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Select Date & Time:
            <input
              type="datetime-local"
              required
              max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field"
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.95rem', fontWeight: '600' }}
          >
            <Check size={16} /> Confirm Time
          </button>
        </form>
      )}

      {media?.isWatched && (
        <>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />
          
          <button
            type="button"
            className="mobile-sheet-option"
            onClick={handleRemoveLast}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '14px',
              textAlign: 'left',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              width: '100%',
              marginBottom: '0px'
            }}
          >
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Trash2 size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: '600', color: '#f87171' }}>Remove Last Watched</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Delete the most recent watch entry</span>
            </div>
          </button>

          <button
            type="button"
            className={`mobile-sheet-option ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '14px',
              textAlign: 'left',
              padding: '14px 18px',
              borderRadius: '12px',
              background: showHistory ? 'var(--overlay-medium)' : 'var(--overlay-subtle)',
              border: '1px solid ' + (showHistory ? 'var(--accent)' : 'var(--border-color)'),
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              width: '100%',
              marginBottom: '0px'
            }}
          >
            <div style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent)',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <List size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <span style={{ fontWeight: '600' }}>View Watch History</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Show list of all watch logs</span>
            </div>
          </button>

          {showHistory && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginTop: '4px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
                All Watches ({historyLogs.length})
              </span>
              {loadingHistory ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '4px 0' }}>Loading history...</span>
              ) : historyLogs.length === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '4px 0' }}>No watch logs found</span>
              ) : (
                historyLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', flex: 1 }}>
                      {new Date(log.watchedAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteLog(log.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}
                      title="Delete this log"
                      className="hover-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileBottomSheet title={`Watch: ${media?.title || 'Media'}`} onClose={onClose}>
        <div style={{ paddingBottom: '16px' }}>{renderContent()}</div>
      </MobileBottomSheet>
    );
  }

  return (
    <div className="custom-modal-backdrop" onClick={onClose}>
      <div 
        className="custom-modal-content" 
        style={{ maxWidth: '440px', width: '90%' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <h3 style={{ margin: 0, fontWeight: '700', fontSize: '1.2rem' }}>
            Watch: {media?.title || 'Media'}
          </h3>
          <button type="button" className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="custom-modal-body" style={{ padding: '20px 24px' }}>
          {renderContent()}
        </div>

        <div className="custom-modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchOptionsModal;

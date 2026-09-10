import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import api from '../../../api';

const TraktTab = ({ user, setUser, setIsError, setMessage, setSyncing, setSyncProgress, setSyncStep, syncing }) => {
  const [traktUsername, setTraktUsername] = useState(user?.traktUsername || '');
  const [traktClientId, setTraktClientId] = useState(user?.traktClientId || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (user) {
      setTraktUsername(user.traktUsername || '');
      setTraktClientId(user.traktClientId || '');
    }
  }, [user]);

  const handleTraktSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      const res = await api.put('/settings/profile', { traktUsername, traktClientId });
      if (res.data.success) {
        setUser(res.data.user);
        setMessage('Trakt connection details saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || 'Failed to save Trakt details.');
    }
  };

  const handleTraktSync = async (mode) => {
    setSyncing(true);
    setSyncProgress(10);
    setIsError(false);
    setMessage('');

    if (!traktUsername) {
      setSyncing(false);
      setIsError(true);
      setMessage('Trakt Username is required for sync.');
      return;
    }
    setSyncStep(`Syncing ${mode === 'collected' ? 'collected items' : 'watched status'} with Trakt.tv...`);
    try {
      const res = await api.post('/media/import-trakt', {
        username: traktUsername,
        clientId: traktClientId,
        mode
      });
      setSyncProgress(100);
      setSyncStep('Sync complete!');
      setMessage(res.data.message || 'Trakt data imported successfully!');
      setTimeout(() => {
        setSyncing(false);
        setSyncProgress(0);
        setSyncStep('');
      }, 2000);
    } catch (err) {
      setSyncing(false);
      setIsError(true);
      const errMsg = err.response?.data?.error || err.message || 'Failed to sync with Trakt.tv';
      setMessage(errMsg);
      setTimeout(() => {
        setSyncing(false);
        setSyncProgress(0);
        setSyncStep('');
      }, 3000);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <RefreshCw size={20} style={{ color: 'var(--accent)' }} />
        <span>Trakt TV Sync</span>
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
        Pull collections and histories from your Trakt TV profile directly into your custom PopcornClub library lists.
      </p>

      <form onSubmit={handleTraktSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="input-group">
          <label>Trakt Username</label>
          <input
            type="text"
            className="input-field"
            value={traktUsername}
            onChange={e => setTraktUsername(e.target.value)}
            placeholder="e.g. trakt_account"
          />
        </div>

        {/* Advanced Trakt client ID collapsible */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
          <div
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px 0'
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Advanced Client configuration {(!traktClientId && !showAdvanced) ? '(Optional)' : ''}
            </span>
            {showAdvanced ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>

          {showAdvanced && (
            <div style={{ marginTop: '12px' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Custom Trakt Client ID (API Application Key)</label>
                <input
                  type="text"
                  className="input-field"
                  value={traktClientId}
                  onChange={e => setTraktClientId(e.target.value)}
                  placeholder="Paste 64-char client id..."
                />
                <small style={{ color: 'var(--text-muted)', marginTop: '6px', display: 'block', lineHeight: '1.4', fontSize: '0.75rem' }}>
                  If the system default api keys trigger rate limits, construct a free application on <a href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Trakt.tv Developers page</a> and link its client ID.
                </small>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Save Trakt Sync Details
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Sync Operations</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button
            onClick={() => handleTraktSync('collected')}
            disabled={syncing}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
          >
            <RefreshCw size={18} style={{ color: 'var(--accent)' }} className={syncing ? 'spin' : ''} />
            <span>Sync Collected Titles</span>
          </button>

          <button
            onClick={() => handleTraktSync('watched')}
            disabled={syncing}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
          >
            <RefreshCw size={18} style={{ color: 'var(--accent)' }} className={syncing ? 'spin' : ''} />
            <span>Sync Watched History</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraktTab;

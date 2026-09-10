import React, { useState, useEffect, useContext } from 'react';
import { Users, UserPlus, UserMinus, Play, Radio, Check, RefreshCw, Tv, Shield, Heart } from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

const WatchTogetherPage = () => {
  const { user } = useContext(AuthContext);
  const [enabled, setEnabled] = useState(false);
  const [participantIds, setParticipantIds] = useState([]);
  const [shareableUsers, setShareableUsers] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [updatingUsers, setUpdatingUsers] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wtRes, usersRes] = await Promise.all([
        api.get('/watch-together'),
        api.get('/media/users/shareable')
      ]);

      setEnabled(wtRes.data.enabled);
      setParticipantIds(wtRes.data.participantIds || []);
      setActiveSession(wtRes.data.activeSession || null);
      const list = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.users || [];
      setShareableUsers(list);
    } catch (err) {
      console.error('Failed to load Watch Together state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleMode = async () => {
    try {
      setToggling(true);
      const nextState = !enabled;
      const res = await api.post('/watch-together/toggle', { enabled: nextState });
      setEnabled(res.data.enabled);
      showToast(res.data.enabled ? 'Watch Together Mode ENABLED!' : 'Watch Together Mode Disabled.');
    } catch (err) {
      console.error('Failed to toggle Watch Together mode:', err);
      showToast('Error toggling Watch Together mode.');
    } finally {
      setToggling(false);
    }
  };

  const handleUserCheckToggle = async (targetUserId) => {
    try {
      setUpdatingUsers(true);
      const nextIds = participantIds.includes(targetUserId)
        ? participantIds.filter(id => id !== targetUserId)
        : [...participantIds, targetUserId];

      const res = await api.post('/watch-together/participants', { participantIds: nextIds });
      setParticipantIds(res.data.participantIds || []);
      showToast('Watch party members updated!');
    } catch (err) {
      console.error('Failed to update participants:', err);
      showToast('Error updating party members.');
    } finally {
      setUpdatingUsers(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw className="spin" size={32} />
        <span style={{ marginLeft: '12px', fontSize: '1rem', fontWeight: '500' }}>Loading Watch Together...</span>
      </div>
    );
  }

  const selectedUsers = shareableUsers.filter(u => participantIds.includes(u.id));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 60px 16px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'var(--accent)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          fontWeight: '600',
          fontSize: '0.9rem',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div className="desktop-only" style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
          flexShrink: 0
        }}>
          <Users size={30} style={{ color: '#fff' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            Watch Together Mode
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Simultaneously track watch history and episode progress across accounts in real-time.
          </p>
        </div>
      </div>

      {/* Hero Toggle Card */}
      <div className="glass-panel" style={{
        padding: '28px 32px',
        marginBottom: '28px',
        borderRadius: '20px',
        border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border-color)'}`,
        background: enabled ? 'rgba(59, 130, 246, 0.08)' : 'var(--overlay-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            position: 'relative',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {enabled ? (
              <span className="pulse-dot" style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10b981', display: 'block', boxShadow: '0 0 12px #10b981' }} />
            ) : (
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-muted)', display: 'block', opacity: 0.5 }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>
              Watch Together is {enabled ? 'ACTIVE' : 'OFF'}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {enabled
                ? `Syncing play events with ${selectedUsers.length} selected companion account(s).`
                : 'Turn ON to replicate Plex playback and scrobbles for selected friends.'}
            </div>
          </div>
        </div>

        {/* Big Switch Toggle */}
        <button
          onClick={handleToggleMode}
          disabled={toggling}
          style={{
            position: 'relative',
            width: '74px',
            height: '40px',
            borderRadius: '24px',
            background: enabled ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          title={enabled ? "Turn Off Watch Together" : "Turn On Watch Together"}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transform: enabled ? 'translateX(34px)' : 'translateX(0)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {toggling ? (
              <RefreshCw className="spin" size={16} style={{ color: 'var(--accent)' }} />
            ) : enabled ? (
              <Check size={18} style={{ color: 'var(--accent)', strokeWidth: 3 }} />
            ) : null}
          </div>
        </button>
      </div>

      {/* Active Playback Banner if currently playing */}
      {activeSession && (
        <div className="glass-panel" style={{
          padding: '20px 24px',
          marginBottom: '28px',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          background: 'rgba(16, 185, 129, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Radio size={24} style={{ color: '#10b981', animation: 'pulse 1.5s infinite' }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>
                Currently Playing On Plex
              </div>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {activeSession.title}
                {activeSession.type === 'tv' && ` — S${activeSession.season}E${activeSession.episode}`}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--overlay-medium)', padding: '6px 14px', borderRadius: '20px' }}>
            {enabled ? 'Syncing to party members' : 'Enable Watch Together to sync'}
          </div>
        </div>
      )}

      {/* Party Members Checklist Section */}
      <div className="glass-panel" style={{ padding: '28px 32px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>
              Watch Party Members ({selectedUsers.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Select who you are watching with today. Anyone checked will receive simultaneous watch history updates.
            </p>
          </div>
        </div>

        {shareableUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No other user accounts registered in PopcornClub.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {shareableUsers.map(u => {
              const isChecked = participantIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => !updatingUsers && handleUserCheckToggle(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--overlay-subtle)',
                    border: `1.5px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                    cursor: updatingUsers ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isChecked ? 'var(--accent)' : 'var(--overlay-strong)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '1rem'
                    }}>
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
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        u.username.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>
                        {u.name || u.username}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        @{u.username}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '8px',
                    border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                    background: isChecked ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    {isChecked && <Check size={18} style={{ color: '#fff', strokeWidth: 3 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchTogetherPage;

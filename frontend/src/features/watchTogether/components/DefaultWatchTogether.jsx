import React, { useState, useEffect, useContext } from 'react';
import { Users, Check, UserPlus } from 'lucide-react';
import api from '../../../api';
import { AuthContext } from '../../../context/AuthContext';

const DefaultWatchTogether = ({ mediaId, mediaType = 'tv' }) => {
  const { user } = useContext(AuthContext);
  const [participantIds, setParticipantIds] = useState([]);
  const [shareableUsers, setShareableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!mediaId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [wtRes, usersRes] = await Promise.all([
          api.get(`/watch-together/default/${mediaId}?mediaType=${mediaType}`),
          api.get('/media/users/shareable')
        ]);

        setParticipantIds(wtRes.data.participantIds || []);
        const list = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.users || [];
        setShareableUsers(list);
      } catch (err) {
        console.error('Failed to load default watch together state:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mediaId]);

  const handleUserToggle = async (targetUserId) => {
    try {
      setUpdating(true);
      const nextIds = participantIds.includes(targetUserId)
        ? participantIds.filter(id => id !== targetUserId)
        : [...participantIds, targetUserId];

      const res = await api.post(`/watch-together/default/${mediaId}`, { 
        participantIds: nextIds,
        mediaType 
      });
      setParticipantIds(res.data.participantIds || []);
    } catch (err) {
      console.error('Failed to update default participants:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return null; // Return null to not distract while loading metadata
  }

  if (shareableUsers.length === 0) {
    return null; // Don't show if there are no other users
  }

  const selectedUsers = shareableUsers.filter(u => participantIds.includes(u.id));

  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-color)',
          padding: '8px 16px',
          borderRadius: '24px',
          cursor: 'pointer',
          color: participantIds.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: '0.9rem',
          fontWeight: '600',
          transition: 'all 0.2s ease',
        }}
      >
        <Users size={16} />
        <span>Watch Together</span>
        {selectedUsers.length > 0 && (
          <div style={{ display: 'flex', marginLeft: '4px' }}>
            {selectedUsers.map((u, i) => (
              <div 
                key={u.id}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.65rem',
                  border: '2px solid var(--overlay-subtle)',
                  marginLeft: i > 0 ? '-8px' : '0',
                  zIndex: selectedUsers.length - i,
                  overflow: 'hidden'
                }}
                title={u.username}
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
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  u.username.substring(0, 2).toUpperCase()
                )}
              </div>
            ))}
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="glass-panel" style={{ 
          marginTop: '12px', 
          padding: '16px', 
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(0,0,0,0.2)',
          maxWidth: '400px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Select users to automatically sync watch progress for this show, even when global Watch Together is off.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shareableUsers.map(u => {
              const isChecked = participantIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => !updating && handleUserToggle(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'var(--overlay-subtle)',
                    border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                    cursor: updating ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isChecked ? 'var(--accent)' : 'var(--overlay-strong)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '0.8rem'
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
                      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        {u.name || u.username}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                    background: isChecked ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    {isChecked && <Check size={14} style={{ color: '#fff', strokeWidth: 3 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DefaultWatchTogether;

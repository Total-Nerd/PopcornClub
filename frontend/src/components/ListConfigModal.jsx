import React, { useState, useEffect } from 'react';
import { X, Lock, Link as LinkIcon, Globe, Settings, Users } from 'lucide-react';
import api from '../api';

const ListConfigModal = ({ isOpen, onClose, list, onSuccess }) => {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('INVITE');
  const [defaultOrder, setDefaultOrder] = useState('added');
  const [sharedWith, setSharedWith] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Invite state
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (list) {
        setName(list.name || '');
        setVisibility(list.visibility || 'INVITE');
        setDefaultOrder(list.defaultOrder || 'added');
        try {
          setSharedWith(typeof list.sharedWith === 'string' ? JSON.parse(list.sharedWith) : (list.sharedWith || []));
        } catch (e) {
          setSharedWith([]);
        }
      } else {
        setName('');
        setVisibility('INVITE');
        setDefaultOrder('added');
        setSharedWith([]);
      }
      fetchUsers();
    }
  }, [isOpen, list]);

  const fetchUsers = async () => {
    try {
      // Fetch users for invites
      const res = await api.get('/users').catch(() => ({ data: [] })); // Generic users endpoint
      if (res.data) {
        const meRes = await api.get('/auth/me');
        setAvailableUsers(res.data.filter(u => u.id !== meRes.data.id));
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    
    try {
      const payload = {
        name,
        visibility,
        defaultOrder,
        sharedWith: JSON.stringify(sharedWith)
      };

      if (list && list.id) {
        await api.put(`/lists/${list.id}`, payload);
      } else {
        await api.post('/lists', payload);
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save list configuration:', err);
      alert('Failed to save list configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserShare = (userId) => {
    setSharedWith(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const renderInviteModal = () => {
    const filteredUsers = availableUsers.filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="custom-modal-backdrop" style={{ zIndex: 1001 }} onClick={() => setShowInviteModal(false)}>
        <div className="custom-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
          <div className="custom-modal-header">
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Manage Invites</h2>
            <button className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%', background: 'transparent', border: 'none' }} onClick={() => setShowInviteModal(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredUsers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No users found.</div>
              ) : (
                filteredUsers.map(user => {
                  const isShared = sharedWith.includes(user.id);
                  return (
                    <div 
                      key={user.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isShared ? '1px solid var(--accent)' : '1px solid transparent'
                      }}
                      onClick={() => toggleUserShare(user.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '32px', height: '32px', borderRadius: '50%', 
                          background: 'var(--accent)', color: 'white', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '0.9rem'
                        }}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '500' }}>{user.username}</span>
                      </div>
                      <div style={{ 
                        width: '20px', height: '20px', borderRadius: '4px', 
                        border: '2px solid var(--accent)',
                        background: isShared ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isShared && <div style={{ width: '10px', height: '10px', background: 'white', borderRadius: '2px' }} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="custom-modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowInviteModal(false)}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="custom-modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="custom-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
        <div className="custom-modal-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={24} style={{ color: 'var(--accent)' }} />
            {list ? 'Edit List' : 'Create List'}
          </h2>
          <button className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%', background: 'transparent', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-muted)' }}>List Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="E.g., Favorite Sci-Fi"
              required 
              style={{ width: '100%' }}
              disabled={list && list.name === 'Watchlist'}
            />
            {list && list.name === 'Watchlist' && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>The default Watchlist name cannot be changed.</div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-muted)' }}>Default Sort Order</label>
            <select 
              className="input-field" 
              value={defaultOrder} 
              onChange={e => setDefaultOrder(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="added">Added to List (Newest first)</option>
              <option value="titleAsc">Title A-Z</option>
              <option value="titleDesc">Title Z-A</option>
              <option value="releaseDate">Release Year (Newest first)</option>
              <option value="lastWatched">Last Watched</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-muted)' }}>Visibility</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer', border: visibility === 'INVITE' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <input type="radio" name="visibility" value="INVITE" checked={visibility === 'INVITE'} onChange={() => setVisibility('INVITE')} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <Lock size={18} style={{ color: visibility === 'INVITE' ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: '600' }}>Invite Only</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Only you and selected users can view this list.</div>
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer', border: visibility === 'LINK' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <input type="radio" name="visibility" value="LINK" checked={visibility === 'LINK'} onChange={() => setVisibility('LINK')} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <LinkIcon size={18} style={{ color: visibility === 'LINK' ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: '600' }}>Anyone with Link</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Anyone who has the URL can view this list.</div>
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer', border: visibility === 'PUBLIC' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <input type="radio" name="visibility" value="PUBLIC" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <Globe size={18} style={{ color: visibility === 'PUBLIC' ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: '600' }}>Public</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visible to anyone (same as link currently).</div>
                  </div>
                </div>
              </label>

            </div>
          </div>

          {visibility === 'INVITE' && (
            <div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowInviteModal(true)}
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                <Users size={18} />
                Manage Invites ({sharedWith.length})
              </button>
            </div>
          )}

          <div className="custom-modal-footer" style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Saving...' : 'Save List'}
            </button>
          </div>
        </form>
      </div>

      {showInviteModal && renderInviteModal()}
    </div>
  );
};

export default ListConfigModal;

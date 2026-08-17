import React, { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, CheckCircle2, Mail, Trash2 } from 'lucide-react';
import { useModal } from '../../../context/ModalContext';
import api from '../../../api';

const UsersTab = ({ user }) => {
  const { showConfirm } = useModal();
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [isUserActionError, setIsUserActionError] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState('');

  const fetchUsers = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await api.get('/settings/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsUserActionError(false);
    setUserActionMessage('');
    if (!newUsername || !newEmail) {
      setIsUserActionError(true);
      setUserActionMessage('Username and Email are required.');
      return;
    }
    try {
      const res = await api.post('/settings/users', {
        username: newUsername,
        name: newName,
        email: newEmail,
        role: newRole
      });
      if (res.data.success) {
        setUserActionMessage(`User '${newUsername}' created successfully! Invitation link printed to console logs or emailed.`);
        setNewUsername('');
        setNewName('');
        setNewEmail('');
        setNewRole('user');
        fetchUsers();
        setTimeout(() => setUserActionMessage(''), 5000);
      }
    } catch (err) {
      setIsUserActionError(true);
      setUserActionMessage(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const handleDeleteUser = async (userId, usernameToDelete) => {
    const confirmed = await showConfirm(`Are you sure you want to delete user '${usernameToDelete}'? All their collection items and custom lists will be permanently deleted.`);
    if (!confirmed) return;

    setIsUserActionError(false);
    setUserActionMessage('');
    try {
      const res = await api.delete(`/settings/users/${userId}`);
      if (res.data.success) {
        setUserActionMessage(`User '${usernameToDelete}' deleted successfully.`);
        fetchUsers();
        setTimeout(() => setUserActionMessage(''), 3000);
      }
    } catch (err) {
      setIsUserActionError(true);
      setUserActionMessage(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={20} style={{ color: 'var(--accent)' }} />
          <span>User Accounts</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Create, view, and manage user accounts and system access roles.
        </p>
      </div>

      {userActionMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid ' + (isUserActionError ? 'var(--danger)' : 'var(--success)'),
            background: isUserActionError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            fontSize: '0.85rem'
          }}
        >
          {isUserActionError ? <AlertCircle style={{ color: 'var(--danger)' }} /> : <CheckCircle2 style={{ color: 'var(--success)' }} />}
          <span style={{ color: isUserActionError ? 'var(--danger)' : 'var(--success)' }}>{userActionMessage}</span>
        </div>
      )}

      {/* Add New User Form */}
      <form onSubmit={handleAddUser} style={{ background: 'var(--overlay-medium)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>Register New User</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label>Username</label>
            <input
              type="text"
              className="input-field"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="e.g. Neo"
              style={{ fontSize: '0.85rem', padding: '10px 14px' }}
              required
            />
          </div>

          <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label>Display Name (Optional)</label>
            <input
              type="text"
              className="input-field"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Thomas Anderson"
              style={{ fontSize: '0.85rem', padding: '10px 14px' }}
            />
          </div>

          <div className="input-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <label>Email Address</label>
            <input
              type="email"
              className="input-field"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="e.g. neo@thematrix.com"
              style={{ fontSize: '0.85rem', padding: '10px 14px' }}
              required
            />
          </div>

          <div className="input-group" style={{ flex: '1 1 120px', marginBottom: 0 }}>
            <label>Access Role</label>
            <select
              className="input-field"
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              style={{ cursor: 'pointer', fontSize: '0.85rem', padding: '10px 14px' }}
            >
              <option value="user">Standard User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem', height: '42px' }}>
            Create Account
          </button>
        </div>
      </form>

      {/* List of active users */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Existing User Accounts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {usersList.map(u => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--overlay-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'var(--overlay-strong)', display: 'flex', alignItems: 'center', justifyItems: 'center', border: '2px solid ' + (u.role === 'admin' ? 'var(--accent)' : 'transparent') }}>
                  {u.avatarPath ? (
                    <img src={u.avatarPath} alt={u.name || u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      {(u.name || u.username).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    {u.name ? `${u.name} (${u.username})` : u.username}
                  </span>
                  {u.email && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} />
                      {u.email}
                    </span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Joined: {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Plex Username linking field for standard user */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plex:</span>
                  <input
                    type="text"
                    className="input-field"
                    defaultValue={u.plexUser || ''}
                    placeholder="Not linked"
                    style={{ 
                      fontSize: '0.8rem', 
                      padding: '4px 8px', 
                      width: '120px', 
                      borderRadius: '6px', 
                      height: '28px', 
                      background: 'var(--bg-input)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-main)',
                      marginBottom: 0
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    onBlur={async (e) => {
                      const newVal = e.target.value.trim();
                      if (newVal === (u.plexUser || '')) return;
                      try {
                        await api.put(`/settings/users/${u.id}`, { plexUser: newVal || null });
                        setUserActionMessage(`Updated Plex Username for '${u.username}' to '${newVal || 'none'}'.`);
                        setIsUserActionError(false);
                        fetchUsers();
                        setTimeout(() => setUserActionMessage(''), 4000);
                      } catch (err) {
                        setIsUserActionError(true);
                        setUserActionMessage(err.response?.data?.error || 'Failed to update user.');
                      }
                    }}
                  />
                </div>

                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    color: u.role === 'admin' ? '#60a5fa' : 'var(--text-muted)',
                    border: '1px solid ' + (u.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-color)')
                  }}
                >
                  {u.role}
                </span>

                <button
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  disabled={u.id === user?.id || u.username === user?.username}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: (u.id === user?.id || u.username === user?.username) ? 'not-allowed' : 'pointer',
                    opacity: (u.id === user?.id || u.username === user?.username) ? 0.3 : 0.8,
                    padding: '6px'
                  }}
                  title={(u.id === user?.id || u.username === user?.username) ? 'Cannot delete active account' : 'Delete user account'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsersTab;

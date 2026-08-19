import React, { useState, useEffect } from 'react';
import { User, LogOut } from 'lucide-react';
import api from '../../../api';

const ProfileTab = ({ user, setUser, logout, setIsError, setMessage }) => {
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarPath || '');
  const [showSpoilers, setShowSpoilers] = useState(user?.showSpoilers || false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
      setAvatarPreview(user.avatarPath || '');
      setShowSpoilers(user.showSpoilers || false);
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRevertAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(user?.avatarPath || '');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setIsError(true);
      setMessage('Passwords do not match.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', profileName);
      formData.append('email', profileEmail);
      formData.append('showSpoilers', showSpoilers);
      if (profilePassword) {
        formData.append('password', profilePassword);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await api.put('/settings/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setUser(res.data.user);
        setMessage('Profile updated successfully!');
        setProfilePassword('');
        setProfileConfirmPassword('');
        setAvatarFile(null);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <User size={20} style={{ color: 'var(--accent)' }} />
        <span>My Profile</span>
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
        Update your account avatar, name, email address, or change your password.
      </p>

      <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--accent)', background: 'var(--overlay-strong)', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
                  {(profileName || user?.username || '').substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{
              padding: '8px 16px',
              background: 'var(--overlay-medium)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'var(--text-main)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--overlay-strong)'}
            onMouseLeave={(e) => e.target.style.background = 'var(--overlay-medium)'}
            >
              Choose Avatar Image
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarChange} 
                style={{ display: 'none' }} 
              />
            </label>
            {avatarFile && (
              <button 
                type="button" 
                onClick={handleRevertAvatar} 
                style={{ fontSize: '1rem', color: 'var(--danger)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Revert Avatar
              </button>
            )}
          </div>
        </div>

        <div className="input-group">
          <label>Account Username</label>
          <input
            type="text"
            className="input-field"
            value={user?.username || ''}
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
          <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Your primary username cannot be modified.
          </small>
        </div>

        <div className="input-group">
          <label>Display Name</label>
          <input
            type="text"
            className="input-field"
            value={profileName}
            onChange={e => setProfileName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div className="input-group">
          <label>Email Address</label>
          <input
            type="email"
            className="input-field"
            value={profileEmail}
            onChange={e => setProfileEmail(e.target.value)}
            placeholder="e.g. you@example.com"
          />
        </div>

        <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <input
            type="checkbox"
            id="showSpoilersToggle"
            checked={showSpoilers}
            onChange={e => setShowSpoilers(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
          />
          <div>
            <label htmlFor="showSpoilersToggle" style={{ margin: 0, cursor: 'pointer', fontSize: '1rem' }}>Always Show Spoilers</label>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Do not blur comments that are flagged as containing spoilers.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div className="input-group" style={{ flex: '1 1 200px' }}>
            <label>New Password</label>
            <input
              type="password"
              className="input-field"
              value={profilePassword}
              onChange={e => setProfilePassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>

          <div className="input-group" style={{ flex: '1 1 200px' }}>
            <label>Confirm New Password</label>
            <input
              type="password"
              className="input-field"
              value={profileConfirmPassword}
              onChange={e => setProfileConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
          Update Profile Details
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={logout} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 20px', fontSize: '0.9rem' }}>
          <LogOut size={16} />
          <span>Logout of Session</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileTab;

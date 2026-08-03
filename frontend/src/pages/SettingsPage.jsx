import React, { useState, useEffect, useContext } from 'react';
import api from '../api';
import { 
  RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, HardDrive, 
  Download, Wifi, Folder, FolderOpen, Trash2, Play, ChevronRight, Check, X, 
  Palette, User, UserPlus, LogOut, Copy, ShieldAlert, Key, Lock, Mail, Sparkles, Sliders
} from 'lucide-react';
import { THEME_CONFIGS, getStoredThemeConfig, saveThemeConfig } from '../utils/themeManager';
import { syncCalendarOffline, getCachedEventsCount, registerInstallListener, triggerInstallPrompt } from '../utils/pwaHelper';
import { useModal } from '../context/ModalContext';
import { AuthContext } from '../context/AuthContext';

const SettingsPage = () => {
  const { showConfirm } = useModal();
  const { user, setUser, logout } = useContext(AuthContext);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState('profile');
  const [mobileSubViewOpen, setMobileSubViewOpen] = useState(false);

  // Profile states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarPath || '');

  // Plex states
  const [plexUser, setPlexUser] = useState(user?.plexUser || '');
  const [copied, setCopied] = useState(false);
  const [globalCopied, setGlobalCopied] = useState(false);

  // Trakt states
  const [traktUsername, setTraktUsername] = useState(user?.traktUsername || '');
  const [traktClientId, setTraktClientId] = useState(user?.traktClientId || '');

  // System states (Admin only)
  const [tmdbApiKey, setTmdbApiKey] = useState(user?.tmdbApiKey || '');

  // User management states (Admin only)
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [userActionMessage, setUserActionMessage] = useState('');
  const [isUserActionError, setIsUserActionError] = useState(false);

  // Folders and Scanner states (Admin only)
  const [folders, setFolders] = useState([]);
  const [folderPath, setFolderPath] = useState('');
  const [folderType, setFolderType] = useState('movie');
  const [folderWatch, setFolderWatch] = useState(false);
  const [scannerStatus, setScannerStatus] = useState({ isScanning: false, lastScanTime: null, currentProgress: 'Idle' });
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browseCurrentPath, setBrowseCurrentPath] = useState('/');
  const [browseParentPath, setBrowseParentPath] = useState(null);
  const [browseDirs, setBrowseDirs] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [drives, setDrives] = useState([]);

  // Save/Sync messages
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // PWA & Offline states
  const [isInstallable, setIsInstallable] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('pwa_last_sync_time'));
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [themeConfig, setThemeConfig] = useState(() => getStoredThemeConfig());

  const handleThemeChange = (newTheme) => {
    const config = THEME_CONFIGS[newTheme] || THEME_CONFIGS.dark;
    const savedBase = localStorage.getItem(`theme_base_${newTheme}`) || config.defaultBase;
    const savedAccent = localStorage.getItem(`theme_accent_${newTheme}`) || config.defaultAccent;
    
    const updated = { theme: newTheme, baseId: savedBase, accentId: savedAccent };
    setThemeConfig(updated);
    saveThemeConfig(newTheme, savedBase, savedAccent);
  };

  const handleBaseChange = (newBaseId) => {
    setThemeConfig(prev => {
      const updated = { ...prev, baseId: newBaseId };
      saveThemeConfig(updated.theme, updated.baseId, updated.accentId);
      return updated;
    });
  };

  const handleAccentChange = (newAccentId) => {
    setThemeConfig(prev => {
      const updated = { ...prev, accentId: newAccentId };
      saveThemeConfig(updated.theme, updated.baseId, updated.accentId);
      return updated;
    });
  };

  // Synchronize values from AuthContext when user changes
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
      setPlexUser(user.plexUser || '');
      setTraktUsername(user.traktUsername || '');
      setTraktClientId(user.traktClientId || '');
      setAvatarPreview(user.avatarPath || '');
      setTmdbApiKey(user.tmdbApiKey || '');
    }
  }, [user]);

  // Load configured library folders (Admin only)
  const loadFolders = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await api.get('/folders');
      setFolders(res.data.folders || []);
      setScannerStatus(res.data.status || { isScanning: false, lastScanTime: null, currentProgress: 'Idle' });
    } catch (err) {
      console.error('Failed to load folders', err);
    }
  };

  // Poll library scanner status (Admin only)
  useEffect(() => {
    let interval;
    if (user?.role === 'admin' && scannerStatus.isScanning) {
      interval = setInterval(async () => {
        try {
          const res = await api.get('/folders');
          setScannerStatus(res.data.status);
        } catch (err) {
          console.error('Failed to poll scanner status', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [scannerStatus.isScanning, user]);

  // Load standard folders on setup
  useEffect(() => {
    if (user?.role === 'admin') {
      loadFolders();
    }
  }, [user]);

  // Fetch all users list (Admin only)
  const fetchUsers = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await api.get('/settings/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  // Fetch users when tab becomes active
  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'admin') {
      fetchUsers();
    }
  }, [activeTab, user]);

  // Hook for PWA installation and cache count
  useEffect(() => {
    registerInstallListener((eligible) => {
      setIsInstallable(eligible);
    });

    const fetchStats = async () => {
      try {
        const count = await getCachedEventsCount();
        setCachedCount(count);
      } catch (err) {
        console.error('Failed to get cached events count:', err);
      }
    };
    fetchStats();
  }, []);

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileSubViewOpen(true);
  };

  // COPY Webhook URL Helper
  const handleCopyWebhookUrl = () => {
    const url = `${window.location.protocol}//${window.location.host}/api/webhook/plex/${user.plexWebhookToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyGlobalWebhookUrl = () => {
    const url = `${window.location.protocol}//${window.location.host}/api/webhook/plex/global/${user.plexGlobalWebhookToken}`;
    navigator.clipboard.writeText(url);
    setGlobalCopied(true);
    setTimeout(() => setGlobalCopied(false), 2000);
  };

  // Avatar Upload / Preview handler
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

  // Save profile settings (Name, Email, Password, Avatar file)
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

  // Save Plex connection details
  const handlePlexSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      const res = await api.put('/settings/profile', { plexUser });
      if (res.data.success) {
        setUser(res.data.user);
        setMessage('Plex connection details saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || 'Failed to save Plex details.');
    }
  };

  // Save Trakt connection details
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

  // Save system-wide configurations (Admin only)
  const handleSystemSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      const res = await api.put('/settings/system', { tmdbApiKey });
      if (res.data.success) {
        setMessage('Global system settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || 'Failed to save global settings.');
    }
  };

  // Add user account (Admin only)
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

  // Delete user account (Admin only)
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

  // Trakt Sync trigger
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

  // Library folder scanner triggers (Admin only)
  const handleAddFolder = async (e) => {
    e.preventDefault();
    setFolderError('');
    if (!folderPath) {
      setFolderError('Folder path is required.');
      return;
    }
    try {
      await api.post('/folders', {
        path: folderPath,
        type: folderType,
        watch: folderWatch
      });
      setFolderPath('');
      setFolderWatch(false);
      loadFolders();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add folder.';
      setFolderError(msg);
    }
  };

  const handleToggleWatch = async (id, currentWatch) => {
    try {
      await api.put(`/folders/${id}`, {
        watch: !currentWatch
      });
      loadFolders();
    } catch (err) {
      console.error('Failed to toggle active monitoring', err);
    }
  };

  const handleDeleteFolder = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to remove this folder? All associated file references will be deleted.');
    if (!confirmed) return;
    try {
      await api.delete(`/folders/${id}`);
      loadFolders();
    } catch (err) {
      console.error('Failed to delete folder', err);
    }
  };

  const handleScanNow = async () => {
    try {
      await api.post('/folders/scan');
      setScannerStatus(prev => ({ ...prev, isScanning: true, currentProgress: 'Starting scan...' }));
    } catch (err) {
      console.error('Failed to trigger scan', err);
    }
  };

  const handleScanFolder = async (id) => {
    try {
      await api.post(`/folders/${id}/scan`);
      setScannerStatus(prev => ({ ...prev, isScanning: true, currentProgress: 'Starting folder scan...' }));
    } catch (err) {
      console.error('Failed to trigger folder scan', err);
    }
  };

  // Browse Directory Dialog handlers
  const handleBrowseOpen = async (startPath = '/') => {
    setIsBrowserOpen(true);
    setBrowseLoading(true);
    setSearchQuery('');
    try {
      const res = await api.get(`/folders/browse?path=${encodeURIComponent(startPath)}`);
      setBrowseCurrentPath(res.data.currentPath);
      setBrowseParentPath(res.data.parentPath);
      setBrowseDirs(res.data.directories || []);
      setDrives(res.data.drives || []);
    } catch (err) {
      console.error('Failed to browse path', err);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleBrowseNavigate = async (nextPath) => {
    setBrowseLoading(true);
    setSearchQuery('');
    try {
      const res = await api.get(`/folders/browse?path=${encodeURIComponent(nextPath)}`);
      setBrowseCurrentPath(res.data.currentPath);
      setBrowseParentPath(res.data.parentPath);
      setBrowseDirs(res.data.directories || []);
      setDrives(res.data.drives || []);
    } catch (err) {
      console.error('Failed to navigate path', err);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleSelectBrowseFolder = () => {
    setFolderPath(browseCurrentPath);
    setIsBrowserOpen(false);
  };

  // Offline pre-caching calendar sync
  const handleOfflineSync = async () => {
    setSyncingOffline(true);
    setIsError(false);
    setMessage('');
    try {
      const res = await syncCalendarOffline(api);
      if (res.success) {
        setLastSyncTime(new Date().toISOString());
        const count = await getCachedEventsCount();
        setCachedCount(count);
        setMessage(`Offline calendar cache synced successfully! Cached ${res.count} events.`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setIsError(true);
        setMessage(`Failed to sync calendar offline: ${res.error}`);
      }
    } catch (err) {
      setIsError(true);
      setMessage(`Failed to sync calendar offline.`);
    } finally {
      setSyncingOffline(false);
    }
  };

  // PWA trigger install prompt
  const handleInstallApp = async () => {
    try {
      const accepted = await triggerInstallPrompt();
      if (accepted) {
        setIsInstallable(false);
        setMessage('Thank you for installing TVTracker!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to trigger PWA install:', err);
    }
  };

  // Tab definitions
  const tabs = [
    { id: 'profile', name: 'Profile Settings', icon: User },
    { id: 'plex', name: 'Plex Webhook', icon: Wifi },
    { id: 'trakt', name: 'Trakt TV Integration', icon: RefreshCw },
    ...(user?.role === 'admin' ? [
      { id: 'users', name: 'User Management', icon: UserPlus },
      { id: 'system', name: 'Library & Folders', icon: HardDrive }
    ] : []),
    { id: 'theme', name: 'Theme & Options', icon: Palette }
  ];

  return (
    <div style={{ margin: '0 auto', width: '100%' }}>
      <h1 style={{ marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Manage your user profile, connection tokens, sync databases, and application preferences.
      </p>

      {message && (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            borderColor: isError ? 'var(--danger)' : 'var(--success)',
            background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'
          }}
        >
          {isError ? <AlertCircle style={{ color: 'var(--danger)' }} /> : <CheckCircle2 style={{ color: 'var(--success)' }} />}
          <span style={{ color: isError ? 'var(--text-main)' : 'var(--success)' }}>{message}</span>
        </div>
      )}

      {syncing && (
        <div className="glass-panel" style={{ marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw className="spin" size={16} />
              {syncStep}
            </span>
            <span style={{ fontWeight: '600', color: 'var(--accent)' }}>{syncProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--overlay-medium)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${syncProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>
      )}

      <div className={`settings-container ${mobileSubViewOpen ? 'mobile-subview-open' : ''}`}>
        
        {/* Left tabs menu / Sidebar */}
        <div className="settings-sidebar">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`settings-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} />
                  {t.name}
                </span>
                <ChevronRight size={16} style={{ opacity: 0.6 }} />
              </button>
            );
          })}
        </div>

        {/* Right Tab Content area */}
        <div className="settings-content">
          
          {/* Back button for Mobile subviews */}
          <button 
            className="settings-back-header" 
            onClick={() => setMobileSubViewOpen(false)}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
            <span>Back to Settings</span>
          </button>

          {/* TAB: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
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
                  
                  {/* Large Profile circle preview */}
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
          )}

          {/* TAB: PLEX CONFIGURATION */}
          {activeTab === 'plex' && (
            <div className="glass-panel">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wifi size={20} style={{ color: 'var(--accent)' }} />
                <span>Plex Scrobble & Webhook</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Link your TVTracker account to a Plex Media Server to record play/pause events and track watch histories in real-time.
              </p>

              {user?.role === 'admin' && (
                <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
                    Global Plex Webhook (Admin managed)
                  </h3>
                  
                  {/* Plex Global connection status notification */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      border: user?.plexGlobalLastWebhookAt 
                        ? '1px solid rgba(16, 185, 129, 0.25)' 
                        : '1px solid rgba(245, 158, 11, 0.25)',
                      background: user?.plexGlobalLastWebhookAt 
                        ? 'rgba(16, 185, 129, 0.08)' 
                        : 'rgba(245, 158, 11, 0.08)',
                    }}
                  >
                    {/* Status Dot with pulse effect */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24' 
                        }} 
                      />
                      <div 
                        style={{ 
                          position: 'absolute',
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '50%', 
                          background: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24',
                          opacity: 0.35,
                          animation: 'pulse-border 2s infinite ease-in-out'
                        }} 
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: user?.plexGlobalLastWebhookAt ? 'var(--success)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Global Plex Webhook {user?.plexGlobalLastWebhookAt ? 'Active' : 'Inactive / Pending'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {user?.plexGlobalLastWebhookAt ? (
                          <>
                            Last successful global webhook event received on: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{new Date(user.plexGlobalLastWebhookAt).toLocaleString()}</span>
                          </>
                        ) : (
                          'No global webhook events received yet. TVTracker is waiting to receive its first scrobble playback status from your Plex server.'
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
                      Global Webhook URL
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                      Add this global webhook URL in your Plex server settings (Settings &gt; Webhooks &gt; Add Webhook). This global webhook handles events for <strong>all users</strong> on the system based on their linked Plex username.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
                      <span style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                        {`${window.location.protocol}//${window.location.host}/api/webhook/plex/global/${user?.plexGlobalWebhookToken}`}
                      </span>
                      <button 
                        onClick={handleCopyGlobalWebhookUrl}
                        className="btn" 
                        style={{ padding: '6px', background: 'var(--overlay-medium)', color: 'var(--text-main)', borderRadius: '6px' }}
                        title="Copy global webhook URL"
                      >
                        {globalCopied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                      </button>
                    </div>
                    {globalCopied && (
                      <small style={{ color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                        Global Webhook URL copied to clipboard!
                      </small>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>
                  {user?.role === 'admin' ? 'Private Plex Webhook' : 'Plex Webhook Connection'}
                </h3>
                
                {/* Plex connection status notification */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: user?.plexLastWebhookAt 
                      ? '1px solid rgba(16, 185, 129, 0.25)' 
                      : '1px solid rgba(245, 158, 11, 0.25)',
                    background: user?.plexLastWebhookAt 
                      ? 'rgba(16, 185, 129, 0.08)' 
                      : 'rgba(245, 158, 11, 0.08)',
                  }}
                >
                  {/* Status Dot with pulse effect */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div 
                      style={{ 
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%', 
                        background: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24' 
                      }} 
                    />
                    <div 
                      style={{ 
                        position: 'absolute',
                        width: '18px', 
                        height: '18px', 
                        borderRadius: '50%', 
                        background: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24',
                        opacity: 0.35,
                        animation: 'pulse-border 2s infinite ease-in-out'
                      }} 
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: user?.plexLastWebhookAt ? 'var(--success)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Private Webhook Connection {user?.plexLastWebhookAt ? 'Active' : 'Inactive / Pending'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {user?.plexLastWebhookAt ? (
                        <>
                          Last successful private webhook event received on: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{new Date(user.plexLastWebhookAt).toLocaleString()}</span>
                        </>
                      ) : (
                        'No private webhook events received yet. TVTracker is waiting to receive its first scrobble playback status from your Plex server.'
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
                    Your Private Webhook URL
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                    Add this private webhook URL in your Plex server settings to route playing status exclusively to your profile.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px' }}>
                    <span style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                      {`${window.location.protocol}//${window.location.host}/api/webhook/plex/${user?.plexWebhookToken}`}
                    </span>
                    <button 
                      onClick={handleCopyWebhookUrl}
                      className="btn" 
                      style={{ padding: '6px', background: 'var(--overlay-medium)', color: 'var(--text-main)', borderRadius: '6px' }}
                      title="Copy private webhook URL"
                    >
                      {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                    </button>
                  </div>
                  {copied && (
                    <small style={{ color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                      Private Webhook URL copied to clipboard!
                    </small>
                  )}
                </div>

                <form onSubmit={handlePlexSave}>
                  <div className="input-group">
                    <label>Plex Username Filter</label>
                    <input
                      type="text"
                      className="input-field"
                      value={plexUser}
                      onChange={e => setPlexUser(e.target.value)}
                      placeholder="e.g. MyPlexAccountName"
                    />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                      Webhook requests will only update your collection if they are triggered from this Plex account username.
                    </small>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                    Save Plex Connection
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: TRAKT TV INTEGRATION */}
          {activeTab === 'trakt' && (
            <div className="glass-panel">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={20} style={{ color: 'var(--accent)' }} />
                <span>Trakt TV Sync</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Pull collections and histories from your Trakt TV profile directly into your custom TVTracker library lists.
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
          )}

          {/* TAB: USER MANAGEMENT (Admin-only) */}
          {activeTab === 'users' && user?.role === 'admin' && (
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

              {/* Form to add a new account */}
              <form onSubmit={handleAddUser} style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>Create User Account</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                  <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
                    <label>Username</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="e.g. nerd_watcher"
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
          )}

          {/* TAB: LIBRARY & CONFIGURATION (Admin-only) */}
          {activeTab === 'system' && user?.role === 'admin' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <HardDrive size={20} style={{ color: 'var(--accent)' }} />
                  <span>Library & Server Configuration</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Modify global TVTracker connections, API keys, and monitor library folders.
                </p>
              </div>

              {/* Global system configuration */}
              <form onSubmit={handleSystemSave} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} />
                    <span>Global TMDB API Key</span>
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={tmdbApiKey}
                    onChange={e => setTmdbApiKey(e.target.value)}
                    placeholder="Enter TMDB v3 API Key..."
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    This TMDB API key is used globally to parse video file matches, download covers, and map schedules.
                  </small>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                  Save Global Key
                </button>
              </form>

              {/* Folder monitor */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={18} style={{ color: 'var(--accent)' }} />
                  <span>Configured Library Folders</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Map folders containing Movies or TV Shows. TVTracker monitors these directories, scans for media titles, and pulls TMDB entries automatically.
                </p>

                {/* Scanner progress banner */}
                <div style={{ background: 'var(--overlay-subtle)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '24px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Scanner Status:</span>
                    <span style={{ fontWeight: '600', color: scannerStatus.isScanning ? 'var(--accent)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {scannerStatus.isScanning ? (
                        <>
                          <RefreshCw size={14} className="spin" /> Scanning Folders
                        </>
                      ) : (
                        'Idle'
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Full Scan:</span>
                    <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>
                      {scannerStatus.lastScanTime ? new Date(scannerStatus.lastScanTime).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  {scannerStatus.isScanning && (
                    <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', wordBreak: 'break-all' }}>
                      {scannerStatus.currentProgress}
                    </div>
                  )}
                  <button
                    onClick={handleScanNow}
                    disabled={scannerStatus.isScanning}
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '12px', padding: '8px', fontSize: '0.8rem', justifyContent: 'center' }}
                  >
                    <Play size={14} style={{ marginRight: '6px' }} />
                    Trigger System Library Scan
                  </button>
                </div>

                {/* Configured directories */}
                {folders.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-main)' }}>Configured Folders</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {folders.map(f => (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--overlay-subtle)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%', overflow: 'hidden' }}>
                            <span style={{ color: 'var(--text-main)', fontWeight: '500', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={f.path}>
                              {f.path}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                background: f.type === 'movie' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: f.type === 'movie' ? '#34d399' : '#60a5fa'
                              }}>
                                {f.type === 'movie' ? 'Movies' : 'TV Shows'}
                              </span>
                              <span
                                onClick={() => handleToggleWatch(f.id, f.watch)}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  background: f.watch ? 'rgba(139, 92, 246, 0.15)' : 'var(--overlay-subtle)',
                                  color: f.watch ? '#a78bfa' : 'var(--text-muted)',
                                  border: '1px solid ' + (f.watch ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-color)')
                                }}
                                title="Click to toggle active change monitoring"
                              >
                                {f.watch ? 'Monitoring' : 'Poll Only'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleScanFolder(f.id)}
                              disabled={scannerStatus.isScanning}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent)',
                                cursor: scannerStatus.isScanning ? 'default' : 'pointer',
                                padding: '6px',
                                opacity: scannerStatus.isScanning ? 0.5 : 0.8
                              }}
                              title="Scan folder"
                            >
                              <Play size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(f.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                padding: '6px',
                                opacity: 0.8
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new folder path */}
                <form onSubmit={handleAddFolder} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Add Library Folder</h4>

                  {folderError && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} />
                      <span>{folderError}</span>
                    </div>
                  )}

                  <div className="input-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem' }}>Folder Path</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input-field"
                        value={folderPath}
                        onChange={e => setFolderPath(e.target.value)}
                        placeholder="e.g. /media/movies"
                        style={{ fontSize: '0.8rem', flexGrow: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleBrowseOpen('/')}
                        style={{ padding: '0 12px', fontSize: '0.8rem' }}
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem' }}>Media Type</label>
                      <select
                        className="input-field"
                        value={folderType}
                        onChange={e => setFolderType(e.target.value)}
                        style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        <option value="movie">Movies</option>
                        <option value="tv">TV Shows</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="watch-toggle"
                        checked={folderWatch}
                        onChange={e => setFolderWatch(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="watch-toggle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', margin: 0 }}>
                        Active Monitoring
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.85rem' }}>
                    Configure Monitor Path
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: THEME, OPTIONS & PWA */}
          {activeTab === 'theme' && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Palette size={20} style={{ color: 'var(--accent)' }} />
                  <span>Theme & Application Preferences</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Manage color profiles, cache pages offline, or install standalone desktop/mobile applications.
                </p>
              </div>

              {/* Theme customizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={16} style={{ color: 'var(--accent)' }} />
                  <span>Custom Theme Mode & Color Profile</span>
                </h3>

                {/* Theme Selector */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Select Active Theme Mode</label>
                  <select
                    className="input-field"
                    value={themeConfig.theme}
                    onChange={e => handleThemeChange(e.target.value)}
                    style={{ cursor: 'pointer', fontWeight: '500' }}
                  >
                    <option value="dark">Dark Mode (Sleek Slate)</option>
                    <option value="light">Light Mode (Clean Harmonious)</option>
                    <option value="oled">OLED Mode (Pure Ink Black)</option>
                    <option value="colourful">Colourful (Vibrant & Bold)</option>
                    <option value="retro">Retro (Vintage Terminal)</option>
                  </select>
                </div>

                {/* Base Colour Selector */}
                {(() => {
                  const currentConfig = THEME_CONFIGS[themeConfig.theme] || THEME_CONFIGS.dark;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                          {themeConfig.theme === 'retro' ? 'Terminal Background' : themeConfig.theme === 'colourful' ? 'Background Gradient' : 'Base Colour'}
                        </label>
                        {currentConfig.supportsBase && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '600' }}>
                            {currentConfig.bases.find(b => b.id === themeConfig.baseId)?.name || 'Default'}
                          </span>
                        )}
                      </div>

                      {!currentConfig.supportsBase ? (
                        <div style={{ background: 'var(--overlay-subtle)', border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                          <span>OLED Mode uses solid ink black (<code>#000000</code>) to preserve contrast and conserve power on OLED screens.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                          {currentConfig.bases.map(b => {
                            const isSelected = b.id === themeConfig.baseId;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => handleBaseChange(b.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '10px',
                                  background: 'var(--overlay-subtle)',
                                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                  boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.2)' : 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: b.bgGradient || b.bg || '#000',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {isSelected && <Check size={12} style={{ color: '#fff' }} />}
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? '600' : '400', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {b.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Accent Colour / Phosphor Style Selector */}
                {(() => {
                  const currentConfig = THEME_CONFIGS[themeConfig.theme] || THEME_CONFIGS.dark;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                          {themeConfig.theme === 'retro' ? 'Terminal Phosphor Style' : 'Accent Colour'}
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '600' }}>
                          {currentConfig.accents.find(a => a.id === themeConfig.accentId)?.name || 'Default'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                        {currentConfig.accents.map(a => {
                          const isSelected = a.id === themeConfig.accentId;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => handleAccentChange(a.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'var(--overlay-subtle)',
                                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                boxShadow: isSelected ? `0 0 12px ${a.hex}40` : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: a.hex,
                                boxShadow: `0 0 8px ${a.hex}80`,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {isSelected && <Check size={12} style={{ color: ['#ffffff', '#33ff00', '#fffc00', '#00ffff'].includes(a.hex) ? '#000000' : '#ffffff' }} />}
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? '600' : '400', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Live Preview Card */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '16px',
                  marginTop: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Live Theme Preview</span>
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: 'var(--accent-bg)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                      fontWeight: '600'
                    }}>
                      Active Badge
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'var(--accent)',
                      color: 'var(--text-on-accent, #fff)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer'
                    }}>
                      Primary Button
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'var(--accent-bg)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}>
                      Subtle Button
                    </button>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      Sample Input Field
                    </div>
                  </div>
                </div>
              </div>

              {/* PWA offline options */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={16} style={{ color: 'var(--accent)' }} />
                  <span>PWA & Offline Calendar Sync</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
                  TVTracker can cache upcoming movie and show release dates for the next 6 months locally. This enables offline access to the release calendar when disconnected.
                </p>

                <div style={{ background: 'var(--overlay-subtle)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Offline Cache status:</span>
                    <span style={{ fontWeight: '600', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Active
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cached Releases:</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{cachedCount} events</span>
                  </div>
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Caching Sync:</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                      {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    onClick={handleOfflineSync}
                    disabled={syncingOffline}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                  >
                    <RefreshCw size={18} className={syncingOffline ? 'spin' : ''} style={{ color: 'var(--accent)' }} />
                    <span>{syncingOffline ? 'Caching Releases Offline...' : 'Sync Calendar Offline Now'}</span>
                  </button>

                  {isInstallable && (
                    <button
                      onClick={handleInstallApp}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      <Download size={18} />
                      <span>Install Standalone PWA App</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Directory Browser Modal dialog (Admin only) */}
      {isBrowserOpen && user?.role === 'admin' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '550px',
              maxHeight: '85vh',
              background: '#0f0f15',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen style={{ color: 'var(--accent)' }} size={20} />
                Select Library Folder
              </h3>
              <button
                onClick={() => setIsBrowserOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                <strong>Docker Environment Constraint:</strong> Since this app runs inside an isolated Linux Docker container, it cannot see your Windows host filesystem directly. You must bind-mount your Windows folders (e.g. <code>D:\Movies</code>) to container paths (e.g. <code>/movies</code>) in your Docker settings (e.g. <code>-v D:\Movies:/movies</code> or <code>-v D:\:/d</code>).
              </p>

              {/* Search directories input */}
              <div className="input-group" style={{ margin: 0 }}>
                <input
                  type="text"
                  className="input-field"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search directories..."
                />
              </div>

              {/* Drive Shortcuts Selector */}
              {drives.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>System Drives:</span>
                  {drives.map(drive => (
                    <button
                      key={drive}
                      onClick={() => handleBrowseNavigate(drive)}
                      style={{
                        background: browseCurrentPath === drive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid ' + (browseCurrentPath === drive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)'),
                        borderRadius: '6px',
                        color: browseCurrentPath === drive ? '#fff' : 'var(--text-main)',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (browseCurrentPath !== drive) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (browseCurrentPath !== drive) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                    >
                      {drive}
                    </button>
                  ))}
                </div>
              )}

              {/* Path Navigation bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-main)',
                  wordBreak: 'break-all'
                }}
              >
                {browseParentPath !== null && (
                  <button
                    onClick={() => handleBrowseNavigate(browseParentPath)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      color: 'var(--text-main)',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontFamily: 'sans-serif'
                    }}
                  >
                    Up
                  </button>
                )}
                <span>{browseCurrentPath}</span>
              </div>

              {/* Directory List */}
              <div
                style={{
                  minHeight: '200px',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.15)'
                }}
              >
                {browseLoading ? (
                  <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <RefreshCw className="spin" size={24} />
                    <span>Reading directory...</span>
                  </div>
                ) : browseDirs.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {searchQuery ? 'No matching directories found.' : 'No directories found.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {browseDirs
                      .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(d => (
                        <div
                          key={d.path}
                          onClick={() => handleBrowseNavigate(d.path)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: 'var(--text-main)'
                          }}
                          className="browse-item"
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Folder size={16} style={{ color: 'var(--accent)', opacity: 0.8 }} />
                            {d.name}
                          </span>
                          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'rgba(0,0,0,0.1)'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBrowserOpen(false)}
                style={{ fontSize: '0.8rem', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSelectBrowseFolder}
                style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={14} />
                Select This Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

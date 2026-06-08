import React, { useState, useEffect } from 'react';
import api from '../api';
import { RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, HardDrive, Download, Wifi, Folder, FolderOpen, Trash2, Play, ChevronRight, Check, X, Palette } from 'lucide-react';
import { syncCalendarOffline, getCachedEventsCount, registerInstallListener, triggerInstallPrompt } from '../utils/pwaHelper';
import { useModal } from '../context/ModalContext';

const SettingsPage = () => {
  const { showConfirm } = useModal();
  const [plexUser, setPlexUser] = useState('');
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [traktUsername, setTraktUsername] = useState('');
  const [traktClientId, setTraktClientId] = useState('');

  // Local Library Folders state
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


  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // PWA & Offline state
  const [isInstallable, setIsInstallable] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('pwa_last_sync_time'));
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = 'theme-' + newTheme;
  };

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

  const loadFolders = async () => {
    try {
      const res = await api.get('/folders');
      setFolders(res.data.folders || []);
      setScannerStatus(res.data.status || { isScanning: false, lastScanTime: null, currentProgress: 'Idle' });
    } catch (err) {
      console.error('Failed to load folders', err);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/auth/me');
        setPlexUser(res.data.plexUser || '');
        setTmdbApiKey(res.data.tmdbApiKey || '');
        setTraktUsername(res.data.traktUsername || '');
        setTraktClientId(res.data.traktClientId || '');
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    };
    fetchSettings();
    loadFolders();
  }, []);

  useEffect(() => {
    let interval;
    if (scannerStatus.isScanning) {
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
  }, [scannerStatus.isScanning]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsError(false);
    setMessage('');
    try {
      await api.put('/settings', {
        plexUser,
        tmdbApiKey,
        traktUsername,
        traktClientId,

      });
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setIsError(true);
      setMessage('Failed to save settings.');
    }
  };

  const handleTraktSync = async (mode) => {
    setSyncing(true);
    setSyncProgress(10);
    setIsError(false);
    setMessage('');

    // Real Trakt TV API import
    if (!traktUsername) {
      setSyncing(false);
      setIsError(true);
      setMessage('Trakt Username is required for real sync.');
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
    if (!confirmed) {
      return;
    }
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

  return (
    <div style={{ margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Configure external metadata sources, media servers, and sync your watch history.
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
          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${syncProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 100%)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>
      )}

      <div className="settings-grid">

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Core & API Config Card */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Connection Profiles
            </h2>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label>Plex Username</label>
                <input
                  type="text"
                  className="input-field"
                  value={plexUser}
                  onChange={e => setPlexUser(e.target.value)}
                  placeholder="e.g. PlexUsername"
                />
                <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Used to filter and match incoming Plex webhooks.
                </small>
              </div>

              <div className="input-group" style={{ marginTop: '20px' }}>
                <label>TMDB API Key</label>
                <input
                  type="password"
                  className="input-field"
                  value={tmdbApiKey}
                  onChange={e => setTmdbApiKey(e.target.value)}
                  placeholder="Paste v3 API Key..."
                />
                <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Crucial for rich cover posters, cast lists, and airing schedules.
                </small>
              </div>

              <div className="input-group" style={{ marginTop: '20px' }}>
                <label>Trakt Username</label>
                <input
                  type="text"
                  className="input-field"
                  value={traktUsername}
                  onChange={e => setTraktUsername(e.target.value)}
                  placeholder="e.g. trakt_dev"
                />
              </div>



              {/* Advanced API Settings Collapsible */}
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
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
                    Advanced API Settings {(!traktClientId && !showAdvanced) ? '(Optional)' : ''}
                  </span>
                  {showAdvanced ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>

                {showAdvanced && (
                  <div style={{ marginTop: '12px' }}>
                    <div className="input-group">
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trakt Client ID (API Key)</label>
                      <input
                        type="text"
                        className="input-field"
                        value={traktClientId}
                        onChange={e => setTraktClientId(e.target.value)}
                        placeholder="Paste 64-char Client ID..."
                      />
                      <small style={{ color: 'var(--text-muted)', marginTop: '6px', display: 'block', lineHeight: '1.4', fontSize: '0.75rem' }}>
                        Required if the default API key fails or experiences rate-limits. Go to your <a href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Trakt API Apps</a>, register a free application (Redirect URI: <code>urn:ietf:wg:oauth:2.0:oob</code>), and paste its Client ID here.
                      </small>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save Connection Details
                </button>
              </div>
            </form>
          </div>

          {/* PWA & Offline Access Card */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'fit-content' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive size={20} style={{ color: 'var(--accent)' }} />
                <span>PWA & Offline Access</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                Install the TVTracker application on your device for a standalone, app-like experience. Cache the Releases Calendar for the next 6 months to enable browse-capability and offline loading without an active internet connection.
              </p>

              {/* Cache Stats Table */}
              <div style={{ background: 'var(--overlay-subtle)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Offline Cache Status:</span>
                  <span style={{ fontWeight: '600', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> Active
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cached Release Events:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{cachedCount} items</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Offline Sync:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                    {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button
                  onClick={handleOfflineSync}
                  disabled={syncingOffline}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                >
                  <RefreshCw size={18} className={syncingOffline ? 'spin' : ''} style={{ color: 'var(--accent)' }} />
                  <span>{syncingOffline ? 'Caching Releases Offline...' : 'Sync Calendar Offline'}</span>
                </button>

                {isInstallable && (
                  <button
                    onClick={handleInstallApp}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                  >
                    <Download size={18} />
                    <span>Install TVTracker Web App</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Theme Settings Card */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={20} style={{ color: 'var(--accent)' }} />
              <span>Theme Customization</span>
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              Personalize the appearance of TVTracker. Select your preferred color mode.
            </p>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Select Theme</label>
              <select
                className="input-field"
                value={theme}
                onChange={e => handleThemeChange(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="dark">Dark Mode (Default)</option>
                <option value="light">Light Mode</option>
                <option value="oled">OLED Mode (Pure Black)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column with Trakt and Sonarr cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Trakt Sync Card */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'fit-content' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Trakt TV Integration
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                Import and consolidate your shows and movies lists. Trakt integration syncs collected titles and maps watch history to calculate detailed, episode-level completion rates.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <button
                  onClick={() => handleTraktSync('collected')}
                  disabled={syncing}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                >
                  <RefreshCw size={18} style={{ color: 'var(--accent)' }} />
                  <span>Sync Collected Items</span>
                </button>

                <button
                  onClick={() => handleTraktSync('watched')}
                  disabled={syncing}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', border: '1px solid var(--border-color)' }}
                >
                  <RefreshCw size={18} style={{ color: 'var(--accent)' }} />
                  <span>Sync Watched Status</span>
                </button>
              </div>
            </div>
          </div>

          {/* Local Library Folders Card */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'fit-content' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={20} style={{ color: 'var(--accent)' }} />
                <span>Local Library Folders</span>
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                Map local Movie or TV Show folders from the machine running this application. The folders will be recursively scanned for video files and matched on TMDB.
              </p>

              {/* Status Header */}
              <div style={{ background: 'var(--overlay-subtle)', borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--border-color)', marginBottom: '24px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Scan Status:</span>
                  <span style={{ fontWeight: '600', color: scannerStatus.isScanning ? 'var(--accent)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {scannerStatus.isScanning ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Scanning
                      </>
                    ) : (
                      'Idle'
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Scanned:</span>
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
                  Scan All Folders Now
                </button>
              </div>

              {/* List of existing folders */}
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
                            title="Scan this folder now"
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
                            onMouseEnter={(e) => e.target.style.opacity = 1}
                            onMouseLeave={(e) => e.target.style.opacity = 0.8}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add folder form */}
              <form onSubmit={handleAddFolder} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
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
                      style={{ fontSize: '0.8rem' }}
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
                  Add Folder Configuration
                </button>
              </form>
            </div>
          </div>

        </div>

      </div>

      {/* Directory Browser Modal */}
      {isBrowserOpen && (
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

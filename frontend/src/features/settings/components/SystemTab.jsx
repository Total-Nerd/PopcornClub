import React, { useState, useEffect } from 'react';
import { 
  HardDrive, Play, FolderPlus, Folder, Key, 
  Search, Trash2, FolderOpen, X, RefreshCw, ChevronRight, Check
} from 'lucide-react';
import { useModal } from '../../../context/ModalContext';
import api from '../../../api';

const SystemTab = ({ user }) => {
  const { showConfirm } = useModal();
  
  const [tmdbApiKey, setTmdbApiKey] = useState(user?.tmdbApiKey || '');
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
  const [browseVideoFileCount, setBrowseVideoFileCount] = useState(0);
  const [isFromEnv, setIsFromEnv] = useState(false);
  
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const res = await api.get('/settings/system');
        if (res.data.tmdbApiKey) {
          setTmdbApiKey(res.data.tmdbApiKey);
        }
        setIsFromEnv(!!res.data.isFromEnv);
      } catch (err) {
        if (user?.tmdbApiKey) {
          setTmdbApiKey(user.tmdbApiKey);
        }
      }
    };
    if (user?.role === 'admin') {
      fetchSystemSettings();
    }
  }, [user]);

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

  useEffect(() => {
    if (user?.role === 'admin') {
      loadFolders();
    }
  }, [user]);

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
      await api.put(`/folders/${id}`, { watch: !currentWatch });
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
      setBrowseVideoFileCount(res.data.videoFileCount || 0);
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
      setBrowseVideoFileCount(res.data.videoFileCount || 0);
    } catch (err) {
      console.error('Failed to browse path', err);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleSelectBrowseFolder = () => {
    setFolderPath(browseCurrentPath);
    setIsBrowserOpen(false);
  };

  if (user?.role !== 'admin') return null;

  return (
    <>
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={20} style={{ color: 'var(--accent)' }} />
            <span>Library & Server Configuration</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Modify global PopcornClub connections, API keys, and monitor library folders.
          </p>
        </div>

        {/* Global TMDB API Key */}
        <form onSubmit={handleSystemSave} style={{ background: 'var(--overlay-medium)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} style={{ color: 'var(--accent)' }} />
            <span>TMDB Global API Key</span>
            {isFromEnv && (
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: '500' }}>
                Pre-populated from .env
              </span>
            )}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
            This API key is used by the server to fetch high quality metadata for movies and TV shows from TheMovieDB.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <input
                type="text"
                className="input-field"
                value={tmdbApiKey}
                onChange={e => setTmdbApiKey(e.target.value)}
                placeholder="TMDB v3 API Key..."
                style={{ fontSize: '0.85rem', padding: '10px 14px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem', height: '42px' }}>
              Save API Key
            </button>
          </div>
          {message && (
            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isError ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {message}
            </div>
          )}
        </form>

        {/* Local Library Scanner */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={18} style={{ color: 'var(--accent)' }} />
            <span>Local Media Libraries</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status Panel */}
            <div style={{ background: 'var(--overlay-subtle)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scanner Status:</span>
                <span style={{ fontWeight: '600', color: scannerStatus.isScanning ? 'var(--accent)' : 'var(--success)' }}>
                  {scannerStatus.isScanning ? 'Scanning In Progress...' : 'Idle'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Full Scan:</span>
                <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>
                  {scannerStatus.lastScanTime ? new Date(scannerStatus.lastScanTime).toLocaleString() : 'Never'}
                </span>
              </div>
              {scannerStatus.currentProgress && scannerStatus.currentProgress !== 'Idle' && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: scannerStatus.currentProgress.toLowerCase().includes('error') || scannerStatus.currentProgress.toLowerCase().includes('skipped')
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'var(--overlay-medium)',
                  color: scannerStatus.currentProgress.toLowerCase().includes('error') || scannerStatus.currentProgress.toLowerCase().includes('skipped')
                    ? '#f87171'
                    : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontStyle: scannerStatus.isScanning ? 'italic' : 'normal',
                  wordBreak: 'break-all'
                }}>
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
                            cursor: scannerStatus.isScanning ? 'not-allowed' : 'pointer',
                            opacity: scannerStatus.isScanning ? 0.3 : 0.8,
                            padding: '6px'
                          }}
                          title="Scan this folder only"
                        >
                          <RefreshCw size={14} className={scannerStatus.isScanning ? 'spin' : ''} />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(f.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            opacity: 0.8,
                            padding: '6px'
                          }}
                          title="Remove folder"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Directory Form */}
            <form onSubmit={handleAddFolder} style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px', color: 'var(--text-main)' }}>Add Media Folder</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Folder Path</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={folderPath}
                      onChange={e => setFolderPath(e.target.value)}
                      placeholder="/mnt/media/movies"
                      style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleBrowseOpen('/')}
                      style={{ padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      Browse
                    </button>
                  </div>
                  {folderError && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px' }}>{folderError}</span>}
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Content Type</label>
                    <select
                      className="input-field"
                      value={folderType}
                      onChange={e => setFolderType(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    >
                      <option value="movie">Movies</option>
                      <option value="tv">TV Shows</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Real-Time Monitoring</label>
                    <select
                      className="input-field"
                      value={folderWatch ? 'true' : 'false'}
                      onChange={e => setFolderWatch(e.target.value === 'true')}
                      style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    >
                      <option value="false">No (Poll Only)</option>
                      <option value="true">Yes (Watch for Changes)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}>
                  Add Library Folder
                </button>
              </div>
            </form>
          </div>
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
                {browseVideoFileCount > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={14} />
                    <span><strong>{browseVideoFileCount}</strong> video file{browseVideoFileCount === 1 ? '' : 's'} found in this directory</span>
                  </div>
                )}

                {browseLoading ? (
                  <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <RefreshCw className="spin" size={24} />
                    <span>Reading directory...</span>
                  </div>
                ) : browseDirs.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    {searchQuery ? (
                      'No matching directories found.'
                    ) : browseVideoFileCount > 0 ? (
                      <>
                        <span style={{ color: '#34d399', fontWeight: '600' }}>This folder contains {browseVideoFileCount} video file{browseVideoFileCount === 1 ? '' : 's'}.</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click "Select This Folder" below to register and scan it.</span>
                      </>
                    ) : (
                      'No subdirectories found.'
                    )}
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
    </>
  );
};

export default SystemTab;

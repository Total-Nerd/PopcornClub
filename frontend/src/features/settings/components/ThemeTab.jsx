import React, { useState, useEffect } from 'react';
import { Palette, Sliders, CheckCircle2, Check, Sparkles, HardDrive, RefreshCw, Download } from 'lucide-react';
import { THEME_CONFIGS, getStoredThemeConfig, saveThemeConfig } from '../../../utils/themeManager';
import { syncCalendarOffline, getCachedEventsCount, registerInstallListener, triggerInstallPrompt } from '../../../utils/pwaHelper';
import api from '../../../api';

const ThemeTab = () => {
  const [themeConfig, setThemeConfig] = useState(() => getStoredThemeConfig());
  const [isInstallable, setIsInstallable] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('pwa_last_sync_time'));
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

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

  const handleInstallApp = () => {
    triggerInstallPrompt();
  };

  return (
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

      {message && (
        <div style={{ padding: '12px', background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: isError ? 'var(--danger)' : 'var(--success)', borderRadius: '8px', border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}`, fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

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
          PopcornClub can cache upcoming movie and show release dates for the next 6 months locally. This enables offline access to the release calendar when disconnected.
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
  );
};

export default ThemeTab;

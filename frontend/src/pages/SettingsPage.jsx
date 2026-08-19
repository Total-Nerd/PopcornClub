import React, { useState, useContext } from 'react';
import { 
  RefreshCw, AlertCircle, CheckCircle2, ChevronRight, 
  Palette, User, UserPlus, Wifi, EyeOff, HardDrive
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import ProfileTab from '../features/settings/components/ProfileTab';
import PlexTab from '../features/settings/components/PlexTab';
import TraktTab from '../features/settings/components/TraktTab';
import UsersTab from '../features/settings/components/UsersTab';
import SystemTab from '../features/settings/components/SystemTab';
import HiddenTab from '../features/settings/components/HiddenTab';
import ThemeTab from '../features/settings/components/ThemeTab';

const SettingsPage = () => {
  const { user, setUser, logout } = useContext(AuthContext);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState('profile');
  const [mobileSubViewOpen, setMobileSubViewOpen] = useState(false);

  // Global overlay states that child components might need
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileSubViewOpen(true);
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
    { id: 'hidden', name: 'Hidden Items', icon: EyeOff },
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
            <ProfileTab user={user} setUser={setUser} logout={logout} setIsError={setIsError} setMessage={setMessage} />
          )}

          {/* TAB: PLEX */}
          {activeTab === 'plex' && (
            <PlexTab user={user} setUser={setUser} setIsError={setIsError} setMessage={setMessage} />
          )}

          {/* TAB: TRAKT */}
          {activeTab === 'trakt' && (
            <TraktTab user={user} setUser={setUser} setIsError={setIsError} setMessage={setMessage} setSyncing={setSyncing} setSyncProgress={setSyncProgress} setSyncStep={setSyncStep} syncing={syncing} />
          )}

          {/* TAB: USERS (Admin-only) */}
          {activeTab === 'users' && user?.role === 'admin' && (
            <UsersTab user={user} />
          )}

          {/* TAB: LIBRARY & CONFIGURATION (Admin-only) */}
          {activeTab === 'system' && user?.role === 'admin' && (
            <SystemTab user={user} />
          )}

          {/* TAB: HIDDEN ITEMS */}
          {activeTab === 'hidden' && (
            <HiddenTab />
          )}

          {/* TAB: THEME, OPTIONS & PWA */}
          {activeTab === 'theme' && (
            <ThemeTab />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

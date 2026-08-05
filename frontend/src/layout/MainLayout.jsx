import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import PlexSessionWidget from '../components/PlexSessionWidget';
import api from '../api';
import { syncCalendarOffline } from '../utils/pwaHelper';

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showStatus, setShowStatus] = useState(false);
  const [transitioningToOnline, setTransitioningToOnline] = useState(false);
  const [wtState, setWtState] = useState({ enabled: false, participants: [] });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebar-collapsed', String(newVal));
      return newVal;
    });
  };

  const checkWatchTogether = async () => {
    try {
      const res = await api.get('/watch-together');
      setWtState({
        enabled: res.data.enabled,
        participants: res.data.participants || []
      });
    } catch (e) {
      // Ignore errors silently
    }
  };

  useEffect(() => {
    checkWatchTogether();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      setTransitioningToOnline(true);
      const timer = setTimeout(() => {
        setTransitioningToOnline(false);
        setShowStatus(false);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setTransitioningToOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setShowStatus(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Automatically trigger calendar prefetching for next 6 months on mount
    const triggerBackgroundSync = async () => {
      try {
        console.log('[PWA] Starting automatic background offline cache synchronization...');
        const result = await syncCalendarOffline(api);
        if (result.success) {
          console.log(`[PWA] Automatic background sync completed successfully. Cached ${result.count} releases.`);
        }
      } catch (err) {
        console.error('[PWA] Failed automatic background cache sync:', err);
      }
    };
    
    // Slight delay to allow initial page loads to be fast and non-blocking
    const timer = setTimeout(triggerBackgroundSync, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`app-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className={`offline-status-bar ${showStatus ? 'show' : ''} ${transitioningToOnline ? 'online' : 'offline'}`}>
        {transitioningToOnline ? 'Online' : 'Offline'}
      </div>
      <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {wtState.enabled && location.pathname !== '/watch-together' && (
          <div
            className="watch-together-banner-top"
            onClick={() => navigate('/watch-together')}
            title="Click to manage Watch Together Mode"
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} />
            <Users size={16} style={{ flexShrink: 0 }} />
            <span>Watch Together Mode Enabled</span>
            <ChevronRight size={14} style={{ opacity: 0.8, marginLeft: '4px', flexShrink: 0 }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
      </main>
      <PlexSessionWidget />
    </div>
  );
};

export default MainLayout;

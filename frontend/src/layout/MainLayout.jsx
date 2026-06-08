import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import PlexSessionWidget from '../components/PlexSessionWidget';
import api from '../api';
import { syncCalendarOffline } from '../utils/pwaHelper';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebar-collapsed', String(newVal));
      return newVal;
    });
  };

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
      <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      <main className="main-content">
        <Outlet />
      </main>
      <PlexSessionWidget />
    </div>
  );
};

export default MainLayout;

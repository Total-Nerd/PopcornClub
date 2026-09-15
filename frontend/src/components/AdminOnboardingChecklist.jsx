import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Circle, Key, HardDrive, Wifi, UserPlus, 
  ChevronDown, ChevronUp, X, ExternalLink, Sparkles, ArrowRight
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

const AdminOnboardingChecklist = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('popcornclub_onboarding_dismissed') === 'true';
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('popcornclub_onboarding_collapsed') === 'true';
  });

  const [hasTmdbKey, setHasTmdbKey] = useState(false);
  const [hasFolders, setHasFolders] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const [hasPlex, setHasPlex] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        // 1. Check TMDB Key
        let tmdbOk = !!user?.tmdbApiKey;
        try {
          const sysRes = await api.get('/settings/system');
          if (sysRes.data?.tmdbApiKey) {
            tmdbOk = true;
          }
        } catch (e) {}

        // 2. Check Folders
        let foldersOk = false;
        try {
          const folderRes = await api.get('/folders');
          if (folderRes.data?.folders && folderRes.data.folders.length > 0) {
            foldersOk = true;
          }
        } catch (e) {}

        // 3. Check Users count
        let usersOk = false;
        try {
          const usersRes = await api.get('/settings/users');
          if (usersRes.data && usersRes.data.length > 1) {
            usersOk = true;
          }
        } catch (e) {}

        // 4. Check Plex webhook
        const plexOk = !!user?.plexWebhookToken && !!user?.plexLastWebhookAt;

        if (isMounted) {
          setHasTmdbKey(tmdbOk);
          setHasFolders(foldersOk);
          setHasUsers(usersOk);
          setHasPlex(plexOk);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    return () => { isMounted = false; };
  }, [user]);

  if (user?.role !== 'admin' || dismissed) {
    return null;
  }

  const steps = [
    {
      id: 'tmdb',
      title: 'Configure TMDB API Key',
      description: hasTmdbKey 
        ? 'API Key is active. Movies & TV shows can be matched and metadata downloaded.' 
        : 'Required for posters, episode air dates, cast, and search indexing.',
      completed: hasTmdbKey,
      icon: Key,
      tab: 'system',
      actionLabel: hasTmdbKey ? 'Manage Key' : 'Configure API Key',
      required: true
    },
    {
      id: 'folders',
      title: 'Mount & Add Media Folders',
      description: hasFolders 
        ? 'Media folders are configured and ready for automatic or manual scanning.' 
        : 'Connect your movie and TV directories to populate your PopcornClub library.',
      completed: hasFolders,
      icon: HardDrive,
      tab: 'system',
      actionLabel: hasFolders ? 'View Folders' : 'Add Media Folders',
      required: true
    },
    {
      id: 'plex',
      title: 'Setup Plex Webhook (Optional)',
      description: hasPlex 
        ? 'Plex Webhook is receiving scrobbles and sync activity.' 
        : 'Automatically update your watch history in real-time as you stream on Plex.',
      completed: hasPlex,
      icon: Wifi,
      tab: 'plex',
      actionLabel: hasPlex ? 'Webhook Settings' : 'Setup Webhook',
      required: false
    },
    {
      id: 'users',
      title: 'Invite Family & Friends (Optional)',
      description: hasUsers 
        ? 'Multiple user accounts created with independent watch histories.' 
        : 'Add family or friend profiles so they can track their own shows and watchlists.',
      completed: hasUsers,
      icon: UserPlus,
      tab: 'users',
      actionLabel: hasUsers ? 'Manage Accounts' : 'Add Users',
      required: false
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  const handleDismiss = () => {
    localStorage.setItem('popcornclub_onboarding_dismissed', 'true');
    setDismissed(true);
  };

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('popcornclub_onboarding_collapsed', String(next));
  };

  const goToSetting = (tabId) => {
    navigate(`/settings?tab=${tabId}`);
  };

  return (
    <div 
      className="glass-panel"
      style={{
        margin: '0 0 24px 0',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        background: 'linear-gradient(135deg, rgba(26, 20, 44, 0.8) 0%, rgba(15, 15, 25, 0.9) 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background ambient glow */}
      <div 
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} 
      />

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.2)',
              color: 'var(--accent)'
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Admin Setup Checklist
              </h3>
              <span 
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: completedCount === totalCount ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                  color: completedCount === totalCount ? '#34d399' : '#c084fc',
                  border: '1px solid ' + (completedCount === totalCount ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)')
                }}
              >
                {completedCount} of {totalCount} completed
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Complete these steps to finish setting up your fresh PopcornClub server instance.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleToggleCollapse}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Dismiss checklist"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div 
        style={{
          width: '100%',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '2px',
          marginTop: '12px',
          overflow: 'hidden'
        }}
      >
        <div 
          style={{
            height: '100%',
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #8b5cf6 0%, #10b981 100%)',
            transition: 'width 0.4s ease'
          }} 
        />
      </div>

      {/* Step Items List */}
      {!collapsed && (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
            marginTop: '16px'
          }}
        >
          {steps.map(step => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: step.completed ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid ' + (step.completed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)'),
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div 
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: step.completed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          color: step.completed ? '#34d399' : 'var(--text-muted)'
                        }}
                      >
                        <Icon size={15} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                        {step.title}
                      </span>
                    </div>

                    {step.completed ? (
                      <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                    ) : (
                      <Circle size={18} style={{ color: 'var(--text-muted)', opacity: 0.4, flexShrink: 0 }} />
                    )}
                  </div>

                  <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {step.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => goToSetting(step.tab)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: step.completed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid ' + (step.completed ? 'rgba(255, 255, 255, 0.1)' : 'rgba(139, 92, 246, 0.3)'),
                      color: step.completed ? 'var(--text-main)' : '#c084fc',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{step.actionLabel}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminOnboardingChecklist;

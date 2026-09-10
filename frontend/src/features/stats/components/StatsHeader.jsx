import React, { useState } from 'react';
import { User, Share2, Tv, Film } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import { useModal } from '../../../context/ModalContext';
import { formatWatchTime } from '../utils';
import { copyToClipboard } from '../../../utils/clipboard';

const StatsHeader = () => {
  const { stats, mediaTypeFilter, getActiveSummary } = useStatsStore();
  const { showAlert } = useModal();
  const [copied, setCopied] = useState(false);

  const { currentSummary, activePlayCount, activeMinutes } = getActiveSummary();

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.protocol}//${window.location.host}/stats/${stats?.user?.username}`;
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      showAlert('Share link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showAlert('Failed to copy share link to clipboard', 'error');
    }
  };

  return (
    <>
      {/* 1. Hero Covered Screen */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '80px 40px', 
          borderRadius: '24px', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(15,23,42,0.85) 100%)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          minHeight: '65vh',
          boxSizing: 'border-box'
        }}
      >
        {/* Glow Spheres */}
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '50%', top: '-50px', left: '-50px', filter: 'blur(100px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(6, 182, 212, 0.2)', borderRadius: '50%', bottom: '-100px', right: '-100px', filter: 'blur(120px)', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', maxWidth: '850px' }}>
          {/* User profile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--accent)', boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)' }}>
              {stats?.user?.avatarPath ? (
                <img src={stats.user.avatarPath} alt={stats.user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--overlay-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={36} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', color: '#fff', fontWeight: '700' }}>
                {stats?.user?.name || stats?.user?.username || ''}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                @{stats?.user?.username || ''}
              </span>
            </div>
          </div>

          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            PopcornClub Wrapped
          </span>

          <h1 style={{ 
            fontSize: '3.6rem', 
            fontWeight: '900', 
            color: '#fff', 
            margin: 0, 
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            textShadow: '0 10px 30px rgba(0,0,0,0.6)'
          }}>
            Your Viewing Stories, <br />
            <span style={{ background: 'linear-gradient(135deg, #c084fc 0%, #60a5fa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Unfolded.
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '8px 0 16px 0', maxWidth: '640px' }}>
            Every play, every viewing milestone, every late-night session. We've compiled your history into a gorgeous visual gallery. Scroll down to see your highlights.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={handleCopyShareLink} 
              className="btn" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'var(--accent)', 
                color: '#fff', 
                padding: '12px 24px', 
                borderRadius: '12px',
                fontWeight: '700',
                boxShadow: '0 8px 20px rgba(124, 58, 237, 0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={18} />
              <span>Share My Wrapped</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Massive Wrapped Metric Grid */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '20px'
        }}
      >
        <div className="glass-panel wrapped-metric-card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Views</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#c084fc', marginTop: '12px' }}>{activePlayCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>plays logged</div>
        </div>

        <div className="glass-panel wrapped-metric-card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time Spent</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#60a5fa', marginTop: '12px' }}>{formatWatchTime(activeMinutes)}</div>
          {mediaTypeFilter === 'all' ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span title="TV Shows"><Tv size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>{formatWatchTime(currentSummary.tvMinutes)}</span>
              <span>&bull;</span>
              <span title="Movies"><Film size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>{formatWatchTime(currentSummary.movieMinutes)}</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>of screen time</div>
          )}
        </div>

        {mediaTypeFilter !== 'shows' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Movies Completed</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#34d399', marginTop: '12px' }}>{currentSummary.movieCount}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>movies release logs</div>
          </div>
        )}

        {mediaTypeFilter !== 'movies' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Episodes Watched</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fb7185', marginTop: '12px' }}>{currentSummary.episodeCount}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>tv episode viewings</div>
          </div>
        )}
      </div>
    </>
  );
};

export default StatsHeader;

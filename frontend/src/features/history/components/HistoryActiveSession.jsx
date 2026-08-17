import React from 'react';
import LazyImage from '../../../components/LazyImage';
import { useHistoryStore } from '../store/useHistoryStore';
import { formatDurationWithSeconds } from '../utils';

const HistoryActiveSession = () => {
  const { activeSession, showPosters } = useHistoryStore();

  if (!activeSession) return null;

  return (
    <div 
      className="glass-panel" 
      style={{ 
        marginBottom: '20px', 
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(124, 58, 237, 0.03) 100%)', 
        border: '1px solid rgba(239, 68, 68, 0.25)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.05)',
        borderRadius: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Pulsing indicator */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
          <div style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--danger)', opacity: 0.4, animation: 'pulse-border 2s infinite ease-in-out' }} />
        </div>

        {/* Poster preview */}
        {showPosters && activeSession.posterPath && (
          <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <LazyImage
              src={`https://image.tmdb.org/t/p/w92${activeSession.posterPath}`}
              alt={activeSession.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
              Currently Watching
            </span>
            {activeSession.user && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ({activeSession.user})
              </span>
            )}
          </div>
          <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.05rem' }}>
            {activeSession.type === 'episode' ? activeSession.grandparentTitle : activeSession.title}
          </span>
          {activeSession.type === 'episode' && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              S{activeSession.season}E{activeSession.episode} — "{activeSession.title}"
            </div>
          )}
        </div>
      </div>

      {/* Progress details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px', flex: '1 1 200px', maxWidth: '350px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
          <span>{formatDurationWithSeconds(Math.round(activeSession.viewOffset / 1000))}</span>
          <span>{formatDurationWithSeconds(Math.round(activeSession.duration / 1000))} ({activeSession.duration > 0 ? Math.round((activeSession.viewOffset / activeSession.duration) * 100) : 0}%)</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'var(--overlay-medium)', borderRadius: '3px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${activeSession.duration > 0 ? Math.round((activeSession.viewOffset / activeSession.duration) * 100) : 0}%`, 
              height: '100%', 
              background: 'var(--danger)', 
              borderRadius: '3px' 
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default HistoryActiveSession;

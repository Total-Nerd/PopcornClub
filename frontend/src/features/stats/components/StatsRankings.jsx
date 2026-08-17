import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Award, Info } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import LazyImage from '../../../components/LazyImage';

const StatsRankings = () => {
  const { stats, mediaTypeFilter } = useStatsStore();
  const navigate = useNavigate();

  return (
    <>
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', 
          gap: '24px',
          margin: '16px 0'
        }}
      >
        {/* Male Actors */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} style={{ color: 'var(--accent)' }} />
            Top Actors (Male)
          </h3>
          {(stats?.topMaleActors || []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>No actors statistics.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(stats?.topMaleActors || []).map((actor, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-muted)', width: '24px', textAlign: 'center' }}>#{idx + 1}</div>
                  <div className="actor-avatar-container" style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)', transition: 'all 0.3s ease' }}>
                    {actor.profilePath ? (
                      <LazyImage src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'var(--overlay-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={18} /></div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Link 
                      to={`/person/${actor.id}`}
                      className="actionable-text"
                      style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                    >
                      {actor.name}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {actor.weight} viewings
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Female Actors */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} style={{ color: 'var(--accent)' }} />
            Top Actors (Female)
          </h3>
          {(stats?.topFemaleActors || []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>No actors statistics.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(stats?.topFemaleActors || []).map((actor, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-muted)', width: '24px', textAlign: 'center' }}>#{idx + 1}</div>
                  <div className="actor-avatar-container" style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)', transition: 'all 0.3s ease' }}>
                    {actor.profilePath ? (
                      <LazyImage src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`} alt={actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'var(--overlay-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={18} /></div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Link 
                      to={`/person/${actor.id}`}
                      className="actionable-text"
                      style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                    >
                      {actor.name}
                    </Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {actor.weight} viewings
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TV Networks */}
        {mediaTypeFilter !== 'movies' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Award size={18} style={{ color: 'var(--accent)' }} />
              Top TV Networks
            </h3>
            {(stats?.topNetworks || []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>No networks statistics.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(stats?.topNetworks || []).map((net, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-muted)', width: '24px', textAlign: 'center' }}>#{idx + 1}</div>
                    <div className="network-logo-container" style={{ width: '54px', height: '30px', background: 'transparent', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '4px', transition: 'all 0.3s ease' }}>
                      {net.logoPath ? (
                        <img src={`https://image.tmdb.org/t/p/w92${net.logoPath}`} alt={net.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0px 0px 4px rgba(255,255,255,0.7)) drop-shadow(0px 0px 1px rgba(255,255,255,1))' }} />
                      ) : (
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>TV</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem' }}>
                        {net.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {net.weight} views
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(!stats?.topMaleActors || stats.topMaleActors.length === 0) && (!stats?.topFemaleActors || stats.topFemaleActors.length === 0) && (
        /* Warn that TMDB is missing */
        <div 
          className="glass-panel" 
          style={{ 
            padding: '20px 24px', 
            borderRadius: '16px', 
            border: '1px solid rgba(245, 158, 11, 0.25)', 
            background: 'rgba(245, 158, 11, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '16px 0'
          }}
        >
          <Info size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Actor and Network metrics are currently unavailable. Ensure a valid TMDB API Key is configured in your <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '600' }} onClick={() => navigate('/settings')}>Settings</span> to enable these insights.
          </span>
        </div>
      )}
    </>
  );
};

export default StatsRankings;

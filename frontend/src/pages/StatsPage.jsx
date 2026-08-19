import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, User } from 'lucide-react';
import { useStatsStore } from '../features/stats/store/useStatsStore';

// Feature Components
import StatsHeader from '../features/stats/components/StatsHeader';
import StatsFilters from '../features/stats/components/StatsFilters';
import StatsHeatmap from '../features/stats/components/StatsHeatmap';
import StatsLineChart from '../features/stats/components/StatsLineChart';
import StatsCoWatching from '../features/stats/components/StatsCoWatching';
import StatsSpotlight from '../features/stats/components/StatsSpotlight';
import StatsGallery from '../features/stats/components/StatsGallery';
import StatsRankings from '../features/stats/components/StatsRankings';

const StatsPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const { 
    loading, 
    error, 
    stats, 
    fetchStats, 
    timeRangeFilter, 
    mediaTypeFilter, 
    watchedTogetherChartType, 
    setWatchedTogetherChartType 
  } = useStatsStore();

  useEffect(() => {
    if (username) {
      fetchStats(username);
    }
  }, [username, timeRangeFilter, fetchStats]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeft: '4px solid var(--accent)', borderRadius: '50%', width: '45px', height: '45px', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--danger)', marginBottom: '12px' }}>Error Loading Stats</div>
        <p>{error || 'An unexpected error occurred.'}</p>
        <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ marginTop: '20px' }}>Go Back</button>
      </div>
    );
  }

  // Spotlights from minutes duration (fallback to play count)
  const topShow = stats.topShowsByMinutes?.[0] || stats.topShowsByCount?.[0];
  const topMovie = stats.topMoviesByMinutes?.[0] || stats.topMoviesByCount?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1600px', margin: '0 auto', paddingBottom: '60px', boxSizing: 'border-box' }}>
      
      {/* 1. Hero Covered Screen & Massive Wrapped Metric Grid */}
      <StatsHeader />

      {/* 2. Global Toggles / Filters Bar */}
      <StatsFilters />

      {/* 3. Spotlight: #1 TV Show (Parallax) */}
      {mediaTypeFilter !== 'movies' && topShow && (
        <StatsSpotlight media={topShow} type="tv" rank={1} />
      )}

      {/* 4. Spotlight: #1 Movie (Parallax) */}
      {mediaTypeFilter !== 'shows' && topMovie && (
        <StatsSpotlight media={topMovie} type="movie" rank={1} />
      )}

      {/* 5. Runners-up Horizontal Poster Galleries */}
      <StatsGallery />

      {/* 6. Behavior Charts side-by-side (flex width usage) */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', 
          gap: '24px',
          margin: '16px 0'
        }}
      >
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              Watch Activity Heatmap
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
              Your daily release and watch contributions over the last 365 days. Darker green blocks represent days with more viewings.
            </p>
          </div>
          <StatsHeatmap />
        </div>

        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
              Viewing Frequency
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
              Plotting your watching frequency over time. Use the period filter at the top to adjust the interval range.
            </p>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <StatsLineChart />
          </div>
        </div>

        {/* Watched Together */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={18} style={{ color: 'var(--accent)' }} />
                Watched Together
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Breakdown of time watched alone versus with other users in your sessions.
              </p>
            </div>
            <div style={{ display: 'flex', background: 'var(--overlay-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setWatchedTogetherChartType('pie')}
                style={{ padding: '4px 10px', border: 'none', background: watchedTogetherChartType === 'pie' ? 'var(--accent)' : 'transparent', color: watchedTogetherChartType === 'pie' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}
              >Pie</button>
              <button 
                onClick={() => setWatchedTogetherChartType('bar')}
                style={{ padding: '4px 10px', border: 'none', background: watchedTogetherChartType === 'bar' ? 'var(--accent)' : 'transparent', color: watchedTogetherChartType === 'bar' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}
              >Bar</button>
            </div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <StatsCoWatching />
          </div>
        </div>
      </div>

      {/* 7. Actors & TV Networks (Circular grid) */}
      <StatsRankings />

      {/* Global CSS Styles for Animations & Interactions */}
      <style>{`
        .heatmap-cell {
          transform-box: fill-box;
          transform-origin: center;
        }
        .heatmap-cell:hover {
          stroke: #fff;
          stroke-width: 2px;
          filter: drop-shadow(0 0 4px var(--accent));
        }
        .spotlight-poster-card:hover {
          transform: translateY(-8px) scale(1.03);
        }
        .spotlight-poster-card.spotlight-tv:hover {
          box-shadow: 0 25px 50px rgba(124, 58, 237, 0.65) !important;
        }
        .spotlight-poster-card.spotlight-movie:hover {
          box-shadow: 0 25px 50px rgba(59, 130, 246, 0.65) !important;
        }
        .ranked-gallery-card:hover {
          transform: translateY(-6px) scale(1.03);
          border-color: var(--accent) !important;
          box-shadow: 0 15px 35px rgba(124, 58, 237, 0.45) !important;
        }
        .wrapped-metric-card {
          transition: all 0.3s ease;
          background: rgba(255,255,255,0.02) !important;
        }
        .wrapped-metric-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255,255,255,0.15) !important;
          background: rgba(255,255,255,0.04) !important;
        }
        .actor-avatar-container:hover {
          transform: scale(1.1);
          border-color: var(--accent) !important;
        }
        .network-logo-container:hover {
          transform: scale(1.08);
          background: #f0f0f0 !important;
          border-color: var(--accent) !important;
        }
        .actionable-text {
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .actionable-text:hover {
          text-decoration: underline !important;
          color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
};

export default StatsPage;

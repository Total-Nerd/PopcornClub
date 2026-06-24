import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { Tv, Film, Clock, Calendar, User, Award, Share2, Check, TrendingUp, Info } from 'lucide-react';
import LazyImage from '../components/LazyImage';

// Helper to format minutes into a friendly string (e.g. "2h 45m" or "45m")
const formatWatchTime = (minutes) => {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parallax Spotlight Section Component
const ParallaxSpotlight = ({ media, type, rank = 1, navigate }) => {
  const sectionRef = useRef(null);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      if (rect.top < windowHeight && rect.bottom > 0) {
        // Calculate offset position relative to viewport scroll
        const scrollPercent = (rect.top / windowHeight);
        setOffsetY(scrollPercent * 150); // parallax effect translation
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial run
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!media) return null;

  const title = media.title;
  const poster = media.posterPath;
  const backdrop = media.backdropPath;
  const count = media.count;
  const minutes = media.minutes;

  return (
    <div
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        borderRadius: '24px',
        margin: '48px 0',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
        boxSizing: 'border-box'
      }}
    >
      {/* Background Parallax Backdrop */}
      {backdrop ? (
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            left: 0,
            right: 0,
            bottom: '-150px',
            backgroundImage: `url(https://image.tmdb.org/t/p/w1280${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translateY(${offsetY}px) scale(1.05)`,
            filter: 'brightness(0.4) blur(1px)',
            transition: 'transform 0.05s linear',
            zIndex: 1
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
            zIndex: 1
          }}
        />
      )}

      {/* Radial Gradient overlay to blend edges and make center popup */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.9) 100%), radial-gradient(circle, transparent 30%, rgba(15,23,42,0.85) 100%)',
          zIndex: 2
        }}
      />

      {/* Main Content Layout */}
      <div style={{ position: 'relative', zIndex: 3, width: '100%', maxWidth: '1200px', display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* Left Side: Glowing Poster */}
        <div 
          onClick={() => navigate(type === 'tv' ? `/shows/${media.tmdbId}` : `/movies/${media.tmdbId}`)}
          style={{ 
            width: '280px', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            boxShadow: type === 'tv' ? '0 15px 45px rgba(124,58,237,0.45)' : '0 15px 45px rgba(59,130,246,0.45)', 
            border: type === 'tv' ? '2px solid rgba(124,58,237,0.6)' : '2px solid rgba(59,130,246,0.6)',
            cursor: 'pointer',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            flexShrink: 0
          }}
          className={`spotlight-poster-card spotlight-${type}`}
        >
          {poster ? (
            <img src={`https://image.tmdb.org/t/p/w500${poster}`} alt={title} style={{ width: '100%', display: 'block', aspectRatio: '2/3', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '420px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Poster</div>
          )}
        </div>

        {/* Right Side: Informative & Stylized Wrapped Text */}
        <div style={{ flex: '1 1 500px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Spotlight Label Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              padding: '6px 14px', 
              background: type === 'tv' ? 'rgba(124,58,237,0.3)' : 'rgba(59,130,246,0.3)', 
              color: type === 'tv' ? '#c084fc' : '#60a5fa', 
              borderRadius: '20px', 
              fontSize: '0.8rem', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              border: type === 'tv' ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(59,130,246,0.4)'
            }}>
              YOUR #1 MOST WATCHED {type === 'tv' ? 'TV SHOW' : 'MOVIE'}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              Rank #{rank}
            </span>
          </div>

          {/* Giant Title */}
          <h2 style={{ 
            fontSize: '3rem', 
            fontWeight: '800', 
            color: '#fff', 
            margin: 0, 
            lineHeight: 1.1,
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
            letterSpacing: '-0.02em'
          }}>
            {title}
          </h2>

          {/* Statistics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '10px' }}>
            
            {/* Play Count */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              backdropFilter: 'blur(8px)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '16px', 
              padding: '16px 20px' 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {type === 'tv' ? 'EPISODES WATCHED' : 'TIMES WATCHED'}
              </span>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', color: type === 'tv' ? '#c084fc' : '#60a5fa', marginTop: '6px' }}>
                {count}
              </div>
            </div>

            {/* Time Watched */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              backdropFilter: 'blur(8px)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '16px', 
              padding: '16px 20px' 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL DURATION
              </span>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--success)', marginTop: '6px' }}>
                {formatWatchTime(minutes)}
              </div>
            </div>
            
          </div>

          {/* Short dynamic description */}
          <p style={{ 
            fontSize: '1.05rem', 
            color: 'var(--text-muted)', 
            lineHeight: '1.6', 
            margin: '8px 0 0 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}>
            {type === 'tv' 
              ? `You've spent a significant amount of your TV screen time inside the world of "${title}". From start to finish, you kept coming back for just one more episode!` 
              : `"${title}" was your go-to movie experience. You couldn't resist hitting play and diving into this cinematic masterpiece multiple times.`}
          </p>

        </div>
      </div>
    </div>
  );
};

const StatsPage = () => {
  const { username } = useParams();
  const { user: currentUser } = useContext(AuthContext);
  const { showAlert } = useModal();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Filter States
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all'); // 'all', 'shows', 'movies'
  const [timeRangeFilter, setTimeRangeFilter] = useState('year'); // 'week', 'month', 'year', 'all'
  
  // Link copied state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/stats/${username}`);
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch statistics:', err);
        setError(err.response?.data?.error || 'Failed to load stats dashboard.');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchStats();
    }
  }, [username]);

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.protocol}//${window.location.host}/stats/${username}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showAlert('Share link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

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

  // Extract selected period summary values
  const currentSummary = (stats.summaries || {})[timeRangeFilter] || { movieCount: 0, episodeCount: 0, totalMinutes: 0, movieMinutes: 0, tvMinutes: 0 };
  
  // Total plays for current summary based on media type
  let activePlayCount = 0;
  let activeMinutes = 0;
  if (mediaTypeFilter === 'all') {
    activePlayCount = currentSummary.movieCount + currentSummary.episodeCount;
    activeMinutes = currentSummary.totalMinutes;
  } else if (mediaTypeFilter === 'shows') {
    activePlayCount = currentSummary.episodeCount;
    activeMinutes = currentSummary.tvMinutes;
  } else {
    activePlayCount = currentSummary.movieCount;
    activeMinutes = currentSummary.movieMinutes;
  }

  // --- SVG HEATMAP CALCULATION ---
  const drawHeatmap = () => {
    const cellWidth = 11;
    const cellHeight = 11;
    const cellGap = 3;
    const headerHeight = 15;
    const labelWidth = 30;

    const heatmapData = (stats.activity || []).map(day => {
      let val = day.total || 0;
      if (mediaTypeFilter === 'shows') val = day.tv || 0;
      else if (mediaTypeFilter === 'movies') val = day.movie || 0;
      return { ...day, activeVal: val };
    });

    if (heatmapData.length === 0) {
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '16px 0' }}>
          No activity recorded.
        </div>
      );
    }

    const firstDayDate = new Date(heatmapData[0].date);
    const firstDayOfWeek = firstDayDate.getDay();
    const cells = [];
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ pad: true, row: i, col: 0 });
    }

    let currentCol = 0;
    heatmapData.forEach((day, idx) => {
      const d = new Date(day.date);
      const row = d.getDay();
      if (idx > 0 && row === 0) {
        currentCol++;
      }
      cells.push({
        pad: false,
        row,
        col: currentCol,
        date: day.date,
        count: day.activeVal,
        tv: day.tv,
        movie: day.movie
      });
    });

    const totalCols = currentCol + 1;
    const svgWidth = labelWidth + totalCols * (cellWidth + cellGap);
    const svgHeight = headerHeight + 7 * (cellHeight + cellGap);

    const getCellColor = (count) => {
      if (count === 0) return 'rgba(255, 255, 255, 0.05)';
      if (count === 1) return 'rgba(16, 185, 129, 0.25)';
      if (count === 2) return 'rgba(16, 185, 129, 0.5)';
      if (count <= 4) return 'rgba(16, 185, 129, 0.75)';
      return 'rgba(16, 185, 129, 1.0)';
    };

    const weekdays = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];
    const months = [];
    let lastMonth = -1;

    heatmapData.forEach((day) => {
      const d = new Date(day.date);
      const month = d.getMonth();
      if (month !== lastMonth) {
        const firstOfMonthCell = cells.find(c => c.date === day.date);
        if (firstOfMonthCell) {
          months.push({
            name: monthNames[month],
            col: firstOfMonthCell.col
          });
        }
        lastMonth = month;
      }
    });

    return (
      <div style={{ overflowX: 'auto', width: '100%', padding: '4px 0' }}>
        <svg width={svgWidth} height={svgHeight} style={{ minWidth: `${svgWidth}px` }}>
          {months.map((m, idx) => (
            <text
              key={idx}
              x={labelWidth + m.col * (cellWidth + cellGap)}
              y={10}
              fill="var(--text-muted)"
              fontSize="9px"
              fontWeight="500"
            >
              {m.name}
            </text>
          ))}

          {weekdays.map((w, idx) => (
            w ? (
              <text
                key={idx}
                x={5}
                y={headerHeight + idx * (cellHeight + cellGap) + 9}
                fill="var(--text-muted)"
                fontSize="9px"
                fontWeight="500"
              >
                {w}
              </text>
            ) : null
          ))}

          {cells.map((cell, idx) => {
            if (cell.pad) return null;
            const x = labelWidth + cell.col * (cellWidth + cellGap);
            const y = headerHeight + cell.row * (cellHeight + cellGap);
            
            const d = new Date(cell.date);
            const friendlyDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const tooltipText = `${cell.count} watched on ${friendlyDate} (${cell.tv} shows, ${cell.movie} movies)`;

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                rx={2}
                fill={getCellColor(cell.count)}
                style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                className="heatmap-cell"
              >
                <title>{tooltipText}</title>
              </rect>
            );
          })}
        </svg>
      </div>
    );
  };

  // --- SVG LINE CHART CALCULATION ---
  const drawLineChart = () => {
    const data = (stats.timelines || {})[timeRangeFilter] || [];
    if (data.length === 0) {
      return (
        <div style={{ display: 'flex', height: '160px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
          No data available for this timeline.
        </div>
      );
    }

    const chartPoints = data.map(item => {
      let val = item.total || 0;
      if (mediaTypeFilter === 'shows') val = item.shows || 0;
      else if (mediaTypeFilter === 'movies') val = item.movies || 0;
      return val;
    });

    const maxVal = Math.max(...chartPoints, 5);
    
    const width = 600;
    const height = 180;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const coordinates = data.map((item, idx) => {
      const val = mediaTypeFilter === 'all' ? (item.total || 0) : (mediaTypeFilter === 'shows' ? (item.shows || 0) : (item.movies || 0));
      const x = paddingLeft + (data.length > 1 ? (idx / (data.length - 1)) : 0.5) * chartWidth;
      const y = paddingTop + (1 - (val / maxVal)) * chartHeight;
      return { x, y, label: item.label, value: val };
    });

    let linePath = '';
    let areaPath = '';

    if (coordinates.length > 0) {
      if (coordinates.length === 1) {
        linePath = `M ${coordinates[0].x - 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${coordinates[0].y}`;
        areaPath = `M ${coordinates[0].x - 10} ${height - paddingBottom} L ${coordinates[0].x - 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${coordinates[0].y} L ${coordinates[0].x + 10} ${height - paddingBottom} Z`;
      } else {
        linePath = `M ${coordinates[0].x} ${coordinates[0].y}`;
        areaPath = `M ${coordinates[0].x} ${height - paddingBottom} L ${coordinates[0].x} ${coordinates[0].y}`;

        for (let i = 1; i < coordinates.length; i++) {
          linePath += ` L ${coordinates[i].x} ${coordinates[i].y}`;
          areaPath += ` L ${coordinates[i].x} ${coordinates[i].y}`;
        }
        
        areaPath += ` L ${coordinates[coordinates.length - 1].x} ${height - paddingBottom} Z`;
      }
    }

    const gridTicks = [0, maxVal * 0.5, maxVal].map(v => Math.round(v));
    const labelFilterStep = Math.max(1, Math.floor(data.length / 6));

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {gridTicks.map((tick, idx) => {
            const y = paddingTop + (1 - (tick / maxVal)) * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="9px"
                  fontWeight="600"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {areaPath && (
            <path
              d={areaPath}
              fill="url(#chart-area-grad)"
              style={{ transition: 'all 0.3s ease' }}
            />
          )}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'all 0.3s ease' }}
            />
          )}

          {coordinates.map((pt, idx) => {
            const showLabel = idx % labelFilterStep === 0 || idx === coordinates.length - 1;
            return (
              <g key={idx}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  fill="var(--accent)"
                  stroke="var(--bg-card)"
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                >
                  <title>{`${pt.value} views (${pt.label})`}</title>
                </circle>

                {showLabel && (
                  <text
                    x={pt.x}
                    y={height - 6}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="9px"
                    fontWeight="500"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // Spotlights from minutes duration (fallback to play count)
  const topShow = stats.topShowsByMinutes?.[0] || stats.topShowsByCount?.[0];
  const topMovie = stats.topMoviesByMinutes?.[0] || stats.topMoviesByCount?.[0];

  // Runner-up galleries (ranks #2 - #5)
  const runnerUpShows = (stats.topShowsByMinutes || []).slice(1, 5);
  const runnerUpMovies = (stats.topMoviesByMinutes || []).slice(1, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1600px', margin: '0 auto', paddingBottom: '60px', boxSizing: 'border-box' }}>
      
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
            TVTracker Wrapped
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

      {/* 2. Global Toggles / Filters Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '16px',
          padding: '0 8px'
        }}
      >
        {/* Media type filter */}
        <div style={{ display: 'flex', background: 'var(--overlay-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {['all', 'shows', 'movies'].map(type => (
            <button
              key={type}
              onClick={() => setMediaTypeFilter(type)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: mediaTypeFilter === type ? 'var(--accent)' : 'transparent',
                color: mediaTypeFilter === type ? '#fff' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize'
              }}
            >
              {type === 'all' ? 'All Media' : type}
            </button>
          ))}
        </div>

        {/* Time range filter */}
        <div style={{ display: 'flex', background: 'var(--overlay-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {['week', 'month', 'range_year', 'all'].map(range => {
            const label = range === 'range_year' ? 'year' : range;
            const apiRange = range === 'range_year' ? 'year' : range;
            return (
              <button
                key={range}
                onClick={() => setTimeRangeFilter(apiRange)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: timeRangeFilter === apiRange ? 'var(--accent)' : 'transparent',
                  color: timeRangeFilter === apiRange ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize'
                }}
              >
                {label === 'all' ? 'All Time' : `1 ${label}`}
              </button>
            );
          })}
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
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>of screen time</div>
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

      {/* 4. Spotlight: #1 TV Show (Parallax) */}
      {mediaTypeFilter !== 'movies' && topShow && (
        <ParallaxSpotlight media={topShow} type="tv" rank={1} navigate={navigate} />
      )}

      {/* 5. Spotlight: #1 Movie (Parallax) */}
      {mediaTypeFilter !== 'shows' && topMovie && (
        <ParallaxSpotlight media={topMovie} type="movie" rank={1} navigate={navigate} />
      )}

      {/* 6. Runners-up Horizontal Poster Galleries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '32px', margin: '24px 0' }}>
        {/* Shows Gallery */}
        {mediaTypeFilter !== 'movies' && runnerUpShows.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Tv size={20} style={{ color: 'var(--accent)' }} />
              Top TV Show Runner-ups
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {runnerUpShows.map((show, idx) => (
                <div 
                  key={idx}
                  onClick={() => navigate(`/shows/${show.tmdbId}`)}
                  className="ranked-gallery-card"
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    aspectRatio: '2/3',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {show.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w342${show.posterPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{show.title}</div>
                  )}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                    zIndex: 1
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    zIndex: 2
                  }}>
                    #{idx + 2}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {show.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatWatchTime(show.minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Movies Gallery */}
        {mediaTypeFilter !== 'shows' && runnerUpMovies.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Film size={20} style={{ color: 'var(--accent)' }} />
              Top Movie Runner-ups
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {runnerUpMovies.map((movie, idx) => (
                <div 
                  key={idx}
                  onClick={() => navigate(`/movies/${movie.tmdbId}`)}
                  className="ranked-gallery-card"
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    aspectRatio: '2/3',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {movie.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w342${movie.posterPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{movie.title}</div>
                  )}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                    zIndex: 1
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#06b6d4',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    zIndex: 2
                  }}>
                    #{idx + 2}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {movie.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatWatchTime(movie.minutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7. Behavior Charts side-by-side (flex width usage) */}
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
          {drawHeatmap()}
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
            {drawLineChart()}
          </div>
        </div>
      </div>

      {/* 8. Actors & TV Networks (Circular grid) */}
      {stats.hasTMDB ? (
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
                      <div 
                        onClick={() => navigate(`/person/${actor.id}`)}
                        className="actionable-text"
                        style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}
                      >
                        {actor.name}
                      </div>
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
                      <div 
                        onClick={() => navigate(`/person/${actor.id}`)}
                        className="actionable-text"
                        style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}
                      >
                        {actor.name}
                      </div>
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
                      <div className="network-logo-container" style={{ width: '54px', height: '30px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '4px', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.3s ease' }}>
                        {net.logoPath ? (
                          <img src={`https://image.tmdb.org/t/p/w92${net.logoPath}`} alt={net.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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
      ) : (
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

      {/* Global CSS Styles for Animations & Interactions */}
      <style>{`
        .heatmap-cell:hover {
          fill: var(--accent) !important;
          transform: scale(1.15);
          stroke: #fff;
          stroke-width: 0.5px;
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
          background: rgba(255,255,255,0.08) !important;
          border-color: var(--accent) !important;
        }
        .actionable-text {
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .actionable-text:hover {
          text-decoration: underline !important;
          color: var(--accent-light, #a78bfa) !important;
        }
      `}</style>
    </div>
  );
};

export default StatsPage;

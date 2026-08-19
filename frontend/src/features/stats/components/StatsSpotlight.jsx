import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatWatchTime } from '../utils';

// Parallax Spotlight Section Component
const StatsSpotlight = ({ media, type, rank = 1 }) => {
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
        <Link 
          to={type === 'tv' ? `/shows/${media.tmdbId}` : `/movies/${media.tmdbId}`}
          style={{ 
            width: '280px', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            boxShadow: type === 'tv' ? '0 15px 45px rgba(124,58,237,0.45)' : '0 15px 45px rgba(59,130,246,0.45)', 
            border: type === 'tv' ? '2px solid rgba(124,58,237,0.6)' : '2px solid rgba(59,130,246,0.6)',
            cursor: 'pointer',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            flexShrink: 0,
            textDecoration: 'none'
          }}
          className={`spotlight-poster-card spotlight-${type}`}
        >
          {poster ? (
            <img src={`https://image.tmdb.org/t/p/w500${poster}`} alt={title} style={{ width: '100%', display: 'block', aspectRatio: '2/3', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '420px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Poster</div>
          )}
        </Link>

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

export default StatsSpotlight;

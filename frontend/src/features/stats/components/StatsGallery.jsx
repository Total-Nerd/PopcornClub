import React from 'react';
import { Link } from 'react-router-dom';
import { Tv, Film } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import { formatWatchTime } from '../utils';

const StatsGallery = () => {
  const { stats, mediaTypeFilter } = useStatsStore();

  const runnerUpShows = (stats?.topShowsByMinutes || []).slice(1, 5);
  const runnerUpMovies = (stats?.topMoviesByMinutes || []).slice(1, 5);

  if (runnerUpShows.length === 0 && runnerUpMovies.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '32px', margin: '24px 0' }}>
      {/* Shows Gallery */}
      {mediaTypeFilter !== 'movies' && runnerUpShows.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tv size={20} style={{ color: 'var(--accent)' }} />
            Top TV Show Runner-ups
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: mediaTypeFilter === 'all' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px' }}>
            {runnerUpShows.map((show, idx) => (
              <Link 
                key={idx}
                to={`/shows/${show.tmdbId}`}
                className="ranked-gallery-card"
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '2/3',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  transition: 'all 0.3s ease',
                  textDecoration: 'none',
                  display: 'block'
                }}
              >
                {show.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w342${show.posterPath}`} alt={show.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px', fontSize: '0.8rem' }}>{show.title}</div>
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
              </Link>
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
          <div style={{ display: 'grid', gridTemplateColumns: mediaTypeFilter === 'all' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px' }}>
            {runnerUpMovies.map((movie, idx) => (
              <Link 
                key={idx}
                to={`/movies/${movie.tmdbId}`}
                className="ranked-gallery-card"
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '2/3',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  transition: 'all 0.3s ease',
                  textDecoration: 'none',
                  display: 'block'
                }}
              >
                {movie.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w342${movie.posterPath}`} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px', fontSize: '0.8rem' }}>{movie.title}</div>
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
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsGallery;

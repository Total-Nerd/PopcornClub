import React from 'react';
import { Link } from 'react-router-dom';

const MediaCast = ({ cast, title = "Key Cast" }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>{title}</h3>
      <div className="details-cast-grid">
        {cast.map(actor => (
          <Link
            key={actor.id}
            to={`/person/${actor.id}`}
            style={{
              background: 'var(--overlay-subtle)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'transform 0.2s'
            }}
            className="hover-scale"
          >
            {actor.profile_path ? (
              <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '120px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Profile</div>
            )}
            <div style={{ padding: '8px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={actor.name}>{actor.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={actor.character}>{actor.character}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MediaCast;

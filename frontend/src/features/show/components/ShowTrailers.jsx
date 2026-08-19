import React from 'react';
import { useShowStore } from '../store/useShowStore';

const ShowTrailers = () => {
  const { showDetails, activeTrailerKey, setActiveTrailerKey } = useShowStore();

  if (!showDetails || !showDetails.videos) return null;

  const trailers = showDetails.videos.filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
  
  if (trailers.length === 0) return null;

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Trailers & Clips</h3>
      <div className="details-cast-grid">
        {trailers.map(video => (
          <div
            key={video.id}
            onClick={() => setActiveTrailerKey(video.key)}
            style={{
              background: 'var(--overlay-subtle)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              position: 'relative',
              flex: '0 0 200px',
              minWidth: '200px'
            }}
          >
            <img
              src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
              alt={video.name}
              style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '110px',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }} className="play-overlay">
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div style={{ padding: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }} title={video.name}>
                {video.name}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {video.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeTrailerKey && (
        <div className="custom-modal-backdrop" onClick={() => setActiveTrailerKey(null)}>
          <div className="custom-modal-content" style={{ maxWidth: '800px', width: '95vw', padding: '0', background: '#000', aspectRatio: '16/9', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${activeTrailerKey}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowTrailers;

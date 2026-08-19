import React from 'react';
import { Link } from 'react-router-dom';
import { Tv, Film, Layers, Check, Copy } from 'lucide-react';
import { pad } from '../utils';

const DesktopEventCard = ({ ev, onToggleWatch, onToggleCollect, onOpenDetails, onToggleStackExpand, expandedStacks, isAdmin, showCopyButton, onCopyText, copiedId }) => {
  const isWatched = ev.isWatched;
  const poster = ev.type === 'tv' ? ev.showPoster : ev.posterPath;
  const title = ev.type === 'tv' ? ev.showTitle : ev.title;

  const totalCount = ev.isStacked ? ev.originalEpisodes.length : 1;
  const watchedCount = ev.isStacked ? ev.originalEpisodes.filter(e => e.isWatched).length : (ev.isWatched ? 1 : 0);
  const collectedCount = ev.isStacked ? ev.originalEpisodes.filter(e => e.isCollected).length : (ev.isCollected ? 1 : 0);

  let collectLabel = 'Collect';
  if (ev.isStacked) {
    if (collectedCount === totalCount) {
      collectLabel = 'Collected All';
    } else if (collectedCount === 0) {
      collectLabel = 'Collect All';
    } else {
      collectLabel = `Collected ${collectedCount}/${totalCount}`;
    }
  } else {
    collectLabel = ev.isCollected ? 'Collected' : 'Collect';
  }

  let watchLabel = 'Watch';
  if (ev.isStacked) {
    if (watchedCount === totalCount) {
      watchLabel = 'Watched All';
    } else if (watchedCount === 0) {
      watchLabel = 'Watch All';
    } else {
      watchLabel = `Watched ${watchedCount}/${totalCount}`;
    }
  } else {
    watchLabel = ev.isWatched ? 'Watched' : 'Watch';
  }

  return (
    <div
      className={`glass-panel ${ev.isStacked ? 'calendar-card-stacked' : ''}`}
      onClick={() => {
        if (ev.isStacked) {
          onToggleStackExpand(ev.id);
        } else {
          onOpenDetails(ev);
        }
      }}
      style={{
        padding: '10px',
        fontSize: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'pointer',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        marginBottom: ev.isStacked ? '8px' : '0px',
        width: '100%',
        maxWidth: '100%',
        minWidth: '290px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', position: 'relative' }}>
        {poster ? (
          <Link
            to={ev.type === 'tv' ? `/shows/${ev.tmdbId}` : `/movies/${ev.tmdbId}`}
            className="actionable-poster"
            style={{ display: 'block', textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`https://image.tmdb.org/t/p/w185${poster}`}
              alt={title}
              style={{ width: '70px', borderRadius: '4px', aspectRatio: '2/3', objectFit: 'cover' }}
            />
          </Link>
        ) : (
          <Link 
            to={ev.type === 'tv' ? `/shows/${ev.tmdbId}` : `/movies/${ev.tmdbId}`}
            style={{ width: '60px', height: '90px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }}
            className="actionable-poster"
            onClick={(e) => e.stopPropagation()}
          >
            {ev.type === 'tv' ? <Tv size={20} /> : <Film size={20} />}
          </Link>
        )}
        <div style={{ flex: 1, minWidth: 0, paddingRight: ev.isStacked ? '30px' : '0px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Link 
              to={ev.type === 'tv' ? `/shows/${ev.tmdbId}` : `/movies/${ev.tmdbId}`}
              style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%', cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}
              className="actionable-text"
              onClick={(e) => e.stopPropagation()}
            >
              {title}
            </Link>
            {ev.type === 'movie' && isAdmin && showCopyButton && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyText(e, ev.title, `card-movie-${ev.id}`);
                }}
                className="calendar-copy-btn"
                title={`Copy "${ev.title}"`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copiedId === `card-movie-${ev.id}` ? 'var(--success)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  flexShrink: 0
                }}
              >
                {copiedId === `card-movie-${ev.id}` ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
              </button>
            )}
          </div>
          {ev.type === 'tv' ? (
            <div style={{ color: 'var(--accent)', fontWeight: '500', fontSize: '0.95rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Link
                to={`/shows/${ev.tmdbId}?season=${ev.seasonNumber}&episode=${ev.isStacked ? ev.originalEpisodes[0].episodeNumber : ev.episodeNumber}`}
                className="actionable-text"
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}</span>
                {(ev.isStacked ? ev.originalEpisodes[0].episodeNumber : ev.episodeNumber) === 1 && (
                  <span style={{ fontSize: '0.65rem', padding: '2px 4px', background: 'var(--accent)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>PREMIERE</span>
                )}
              </Link>
              {isAdmin && showCopyButton && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const text = `${ev.showTitle} ${ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}`;
                    onCopyText(e, text, `card-tv-${ev.id}`);
                  }}
                  className="calendar-copy-btn"
                  title={`Copy "${ev.showTitle} ${ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}"`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedId === `card-tv-${ev.id}` ? 'var(--success)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    flexShrink: 0
                  }}
                >
                  {copiedId === `card-tv-${ev.id}` ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                </button>
              )}
              {ev.localTimeStr && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ color: 'var(--text-muted)' }}>{ev.localTimeStr}</span>
                </>
              )}
            </div>
          ) : (
            <div style={{ color: '#c084fc', fontWeight: '500', fontSize: '0.95rem', marginTop: '2px' }}>
              Movie Release
            </div>
          )}
        </div>
        {ev.isStacked && (
          <Layers size={14} style={{ color: 'var(--text-muted)', position: 'absolute', top: 0, right: 0 }} />
        )}
      </div>

      {ev.isStacked && expandedStacks[ev.id] && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
          {ev.originalEpisodes.map(subEv => (
            <div key={subEv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link 
                  to={`/shows/${subEv.tmdbId}?season=${subEv.seasonNumber}&episode=${subEv.episodeNumber}`}
                  style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer', textDecoration: 'none' }} 
                  onClick={(e) => e.stopPropagation()}
                  className="actionable-text"
                >
                  S{pad(subEv.seasonNumber)}E{pad(subEv.episodeNumber)}
                </Link>
                {isAdmin && showCopyButton && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = `${subEv.showTitle || ev.showTitle} S${pad(subEv.seasonNumber)}E${pad(subEv.episodeNumber)}`;
                      onCopyText(e, text, `card-sub-${subEv.id}`);
                    }}
                    className="calendar-copy-btn"
                    title={`Copy "${subEv.showTitle || ev.showTitle} S${pad(subEv.seasonNumber)}E${pad(subEv.episodeNumber)}"`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedId === `card-sub-${subEv.id}` ? 'var(--success)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      borderRadius: '4px',
                      flexShrink: 0
                    }}
                  >
                    {copiedId === `card-sub-${subEv.id}` ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onToggleCollect('collect', subEv)}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 6px',
                    fontSize: '0.8rem',
                    background: subEv.isCollected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                    color: subEv.isCollected ? '#60a5fa' : 'var(--text-muted)'
                  }}
                >
                  {subEv.isCollected ? 'Collected' : 'Collect'}
                </button>
                <button
                  onClick={() => onToggleWatch('watch', subEv)}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 6px',
                    fontSize: '0.8rem',
                    background: subEv.isWatched ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                    color: subEv.isWatched ? 'var(--success)' : 'var(--text-muted)'
                  }}
                >
                  {subEv.isWatched ? 'Watched' : 'Watch'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onToggleCollect('collect', ev)}
          className="btn btn-secondary"
          style={{
            padding: '6px 8px',
            fontSize: '0.9rem',
            background: ev.isCollected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
            color: ev.isCollected ? '#60a5fa' : 'var(--text-muted)',
            flex: 1,
            justifyContent: 'center'
          }}
        >
          {collectLabel}
        </button>
        <button
          onClick={() => onToggleWatch('watch', ev)}
          className="btn btn-secondary"
          style={{
            padding: '6px 8px',
            fontSize: '0.9rem',
            background: ev.isWatched ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
            color: ev.isWatched ? 'var(--success)' : 'var(--text-muted)',
            flex: 1,
            justifyContent: 'center'
          }}
        >
          {watchLabel}
        </button>
      </div>
    </div>
  );
};

export default DesktopEventCard;

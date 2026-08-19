import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tv, Film, Plus, X, Eye, EyeOff, Layers, Check, Copy } from 'lucide-react';
import { pad } from '../utils';

const SwipeableEventCard = ({ ev, onToggleWatch, onToggleCollect, onOpenDetails, onToggleStackExpand, expandedStacks, isAdmin, showCopyButton, onCopyText, copiedId }) => {
  const navigate = useNavigate();
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTranslateX = useRef(0);
  const isHorizontalSwipe = useRef(null);
  const cardRef = useRef(null);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTranslateX.current = translateX;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffY) > Math.abs(diffX)) {
        isHorizontalSwipe.current = false;
        setIsSwiping(false);
        return;
      } else {
        isHorizontalSwipe.current = true;
      }
    }

    if (isHorizontalSwipe.current) {
      if (e.cancelable) {
        e.preventDefault();
      }
      setTranslateX(startTranslateX.current + diffX);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const width = cardRef.current ? cardRef.current.offsetWidth : 300;
    const absX = Math.abs(translateX);
    const p = absX / width;
    const dir = translateX > 0 ? 1 : -1;

    if (p >= 0.8) {
      // Auto-trigger default action
      if (!ev.isCollected) {
        onToggleCollect('collect', ev);
      } else {
        onToggleWatch('watch', ev);
      }
      setTranslateX(0);
    } else if (p >= 0.35) {
      // Snap to reveal both options
      setTranslateX(dir * 160);
    } else if (p >= 0.15) {
      // Snap to reveal first option
      setTranslateX(dir * 80);
    } else {
      // Snap back to 0
      setTranslateX(0);
    }
  };

  const isWatched = ev.isWatched;
  const poster = ev.type === 'tv' ? ev.showPoster : ev.posterPath;
  const title = ev.type === 'tv' ? ev.showTitle : ev.title;

  const absX = Math.abs(translateX);
  const width = cardRef.current ? cardRef.current.offsetWidth : 300;
  const p = absX / width;
  const defaultAction = !ev.isCollected ? 'collect' : 'watch';

  let collectWidth = 0;
  let watchWidth = 0;

  if (absX <= 80) {
    collectWidth = absX;
    watchWidth = 0;
  } else if (absX <= 160) {
    collectWidth = 80;
    watchWidth = absX - 80;
  } else {
    // Both are beyond 80px. Check if we are transitioning to default action only.
    // Transition range is p = 0.5 (equal) to p = 0.8 (default only)
    const equalWidth = absX / 2;
    const factor = Math.min(1, Math.max(0, (p - 0.5) / 0.3)); // 0 to 1

    if (defaultAction === 'collect') {
      collectWidth = equalWidth + factor * equalWidth;
      watchWidth = equalWidth - factor * equalWidth;
    } else {
      collectWidth = equalWidth - factor * equalWidth;
      watchWidth = equalWidth + factor * equalWidth;
    }
  }

  const cOpacity = collectWidth > 15 ? 1 : 0;
  const wOpacity = watchWidth > 15 ? 1 : 0;

  return (
    <div 
      className={`swipe-container ${ev.isStacked ? 'calendar-card-stacked' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '8px',
        marginBottom: ev.isStacked ? '8px' : '0px'
      }}
    >
      <div 
        className="swipe-underlay"
        style={{
          position: 'absolute',
          top: '2px',
          bottom: '2px',
          left: '4px',
          right: '4px',
          display: 'flex',
          flexDirection: translateX > 0 ? 'row' : 'row-reverse',
          justifyContent: 'flex-start',
          alignItems: 'center',
          borderRadius: '6px',
          zIndex: 1,
          background: 'var(--bg-card-solid)',
          overflow: 'hidden'
        }}
      >
        {/* Collect / Uncollect Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollect('collect', ev);
            setTranslateX(0);
          }}
          style={{
            width: `${collectWidth}px`,
            opacity: cOpacity,
            height: '100%',
            background: '#2563eb', // blue
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: isSwiping ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease'
          }}
        >
          {ev.isCollected ? <X size={18} /> : <Plus size={18} />}
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
            {ev.isStacked ? (ev.isCollected ? 'Uncollect All' : 'Collect All') : (ev.isCollected ? 'Uncollect' : 'Collect')}
          </span>
        </button>

        {/* Watch / Unwatch Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatch('watch', ev);
            setTranslateX(0);
          }}
          style={{
            width: `${watchWidth}px`,
            opacity: wOpacity,
            height: '100%',
            background: '#10b981', // green
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: isSwiping ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease'
          }}
        >
          {ev.isWatched ? <EyeOff size={18} /> : <Eye size={18} />}
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
            {ev.isStacked ? (ev.isWatched ? 'Unwatch All' : 'Watch All') : (ev.isWatched ? 'Unwatch' : 'Watch')}
          </span>
        </button>
      </div>

      <div
        ref={cardRef}
        className={`glass-panel swipe-front-card ${isWatched ? 'is-watched' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (translateX !== 0) {
            e.stopPropagation();
            setTranslateX(0);
          } else {
            if (ev.isStacked) {
              onToggleStackExpand(ev.id);
            } else {
              onOpenDetails(ev);
            }
          }
        }}
        style={{
          position: 'relative',
          zIndex: 2,
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '10px',
          fontSize: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          cursor: 'pointer',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
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
              {ev.isCollected && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  background: 'rgba(59, 130, 246, 0.9)',
                  color: '#fff',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}>
                  Collected
                </span>
              )}
              {ev.type === 'movie' && isAdmin && showCopyButton && (
                <button
                  type="button"
                  onClick={(e) => onCopyText(e, ev.title, `swipe-movie-${ev.id}`)}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="calendar-copy-btn"
                  title={`Copy "${ev.title}"`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedId === `swipe-movie-${ev.id}` ? 'var(--success)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    flexShrink: 0
                  }}
                >
                  {copiedId === `swipe-movie-${ev.id}` ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                </button>
              )}
            </div>
            {ev.type === 'tv' ? (
              <div style={{ color: 'var(--accent)', fontWeight: '500', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Link
                  to={`/shows/${ev.tmdbId}?season=${ev.seasonNumber}&episode=${ev.isStacked ? ev.originalEpisodes[0].episodeNumber : ev.episodeNumber}`}
                  className="actionable-text"
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}
                >
                  {ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}
                </Link>
                {isAdmin && showCopyButton && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const text = `${ev.showTitle} ${ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}`;
                      onCopyText(e, text, `swipe-tv-${ev.id}`);
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="calendar-copy-btn"
                    title={`Copy "${ev.showTitle} ${ev.isStacked ? ev.episodeRangeText : `S${pad(ev.seasonNumber)}E${pad(ev.episodeNumber)}`}"`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedId === `swipe-tv-${ev.id}` ? 'var(--success)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      flexShrink: 0
                    }}
                  >
                    {copiedId === `swipe-tv-${ev.id}` ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
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
              <div style={{ color: '#c084fc', fontWeight: '500', fontSize: '0.95rem', marginTop: '4px' }}>
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
                        const text = `${subEv.showTitle || ev.showTitle} S${pad(subEv.seasonNumber)}E${pad(subEv.episodeNumber)}`;
                        onCopyText(e, text, `swipe-sub-${subEv.id}`);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="calendar-copy-btn"
                      title={`Copy "${subEv.showTitle || ev.showTitle} S${pad(subEv.seasonNumber)}E${pad(subEv.episodeNumber)}"`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedId === `swipe-sub-${subEv.id}` ? 'var(--success)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        borderRadius: '4px',
                        flexShrink: 0
                      }}
                    >
                      {copiedId === `swipe-sub-${subEv.id}` ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
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
                      background: subEv.isCollected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: subEv.isCollected ? 'var(--success)' : 'var(--text-muted)'
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
                      background: subEv.isWatched ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: subEv.isWatched ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                  >
                    {subEv.isWatched ? 'Watched' : 'Watch'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeableEventCard;

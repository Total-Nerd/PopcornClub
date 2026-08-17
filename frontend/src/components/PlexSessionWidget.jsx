import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

const PlexSessionWidget = () => {
  const { user } = useContext(AuthContext);
  const [session, setSession] = useState(null);
  const [interpolatedOffset, setInterpolatedOffset] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const lastRatingKey = useRef(null);

  // Helper: Format milliseconds into standard time strings (MM:SS or HH:MM:SS)
  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedSeconds = seconds.toString().padStart(2, '0');
    if (hours > 0) {
      const paddedMinutes = minutes.toString().padStart(2, '0');
      return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
  };

  // 1. Connect to standard WebSocket for real-time Plex playback events
  useEffect(() => {
    if (!user) {
      setSession(null);
      return;
    }

    let socket = null;
    let reconnectTimeout = null;
    let isMounted = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const connect = () => {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[WebSocket] Stopped reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts.`);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'plex-session') {
            reconnectAttempts = 0; // Reset attempts on successful message
            const active = data.session;
            if (active) {
              // If a brand new item started playing, reset the dismissed flag!
              if (active.ratingKey !== lastRatingKey.current) {
                if (isMounted) setIsDismissed(false);
                lastRatingKey.current = active.ratingKey;
              }
              
              if (isMounted) {
                setSession(prev => {
                  // Strictly match deep equality so we don't trigger state change unless something changed
                  const isIdentical = prev &&
                                      prev.ratingKey === active.ratingKey &&
                                      prev.isPlaying === active.isPlaying &&
                                      prev.viewOffset === active.viewOffset &&
                                      prev.updatedAt === active.updatedAt;
                  
                  return isIdentical ? prev : active;
                });
              }
            } else {
              if (isMounted) {
                setSession(null);
                lastRatingKey.current = null;
              }
            }
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      socket.onclose = (e) => {
        if (!isMounted) return;
        reconnectAttempts++;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          console.log(`[WebSocket] Disconnected. Reconnecting in 5s... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeout = setTimeout(connect, 5000);
        } else {
          console.warn(`[WebSocket] Disconnected permanently after ${MAX_RECONNECT_ATTEMPTS} attempts.`);
        }
      };

      socket.onerror = (err) => {
        console.error('[WebSocket] WebSocket error:', err);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (socket) {
        socket.onclose = null; // Prevent reconnect on cleanup close
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  // 2. Local 250ms high-resolution interpolation ticker
  useEffect(() => {
    if (!session) return;

    const updateOffset = () => {
      if (session.isPlaying) {
        const elapsed = Date.now() - session.updatedAt;
        const current = session.viewOffset + elapsed;
        setInterpolatedOffset(session.duration ? Math.min(session.duration, current) : current);
      } else {
        setInterpolatedOffset(session.viewOffset);
      }
    };

    updateOffset();
    const interval = setInterval(updateOffset, 250);

    return () => clearInterval(interval);
  }, [session]);

  const handleCancelManualWatch = async (e) => {
    e.stopPropagation();
    try {
      await api.delete('/media/active-session');
    } catch (err) {
      console.error('Failed to cancel manual watch session:', err);
    }
  };

  // Render nothing if there is no user, no active session, or if the user dismissed it
  if (!user || !session || isDismissed) {
    return null;
  }

  const duration = session.duration || 0;
  const progressPercent = duration > 0 ? Math.min(100, (interpolatedOffset / duration) * 100) : 0;
  const isTV = session.type === 'episode';
  
  // Format Season & Episode padding (e.g. S01E03)
  const formatSE = (s, e) => {
    if (s === null || e === null) return '';
    const padS = s.toString().padStart(2, '0');
    const padE = e.toString().padStart(2, '0');
    return `S${padS}E${padE}`;
  };

  return (
    <div className={`plex-session-widget-container ${session.isPlaying ? 'is-playing' : 'is-paused'}`}>
      <div className="plex-session-card">
        
        {/* Left Side: Media Poster Art (Clickable Link to details card) */}
        {session.tmdbId ? (
          <Link to={isTV ? `/shows?tmdbId=${session.tmdbId}` : `/movies?tmdbId=${session.tmdbId}`} className="plex-media-poster-link">
            <div className="plex-media-poster">
              {session.posterPath ? (
                <img 
                  src={`https://image.tmdb.org/t/p/w185${session.posterPath}`} 
                  alt={session.title || 'Playing Media'} 
                />
              ) : (
                <div className="plex-poster-fallback">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    {isTV ? (
                      <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM8 7.5L16 11l-8 3.5v-7z" />
                    ) : (
                      <path fill="currentColor" d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                    )}
                  </svg>
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="plex-media-poster">
            {session.posterPath ? (
              <img 
                src={`https://image.tmdb.org/t/p/w185${session.posterPath}`} 
                alt={session.title || 'Playing Media'} 
              />
            ) : (
              <div className="plex-poster-fallback">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  {isTV ? (
                    <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM8 7.5L16 11l-8 3.5v-7z" />
                  ) : (
                    <path fill="currentColor" d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                  )}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Center: Playback & Metadata Info */}
        <div className="plex-media-details">
          {isTV ? (
            <>
              <h4 className="plex-media-title">
                {session.tmdbId ? (
                  <Link to={`/shows?tmdbId=${session.tmdbId}`} className="plex-media-link">
                    {session.grandparentTitle || 'TV Show'}
                  </Link>
                ) : (
                  session.grandparentTitle || 'TV Show'
                )}
              </h4>
              <p className="plex-media-subtitle">
                {session.tmdbId ? (
                  <Link to={`/shows?tmdbId=${session.tmdbId}&season=${session.season}`} className="plex-media-link-sub">
                    <span className="plex-se-code">{formatSE(session.season, session.episode)}</span> 
                    {session.title && ` • ${session.title}`}
                  </Link>
                ) : (
                  <>
                    <span className="plex-se-code">{formatSE(session.season, session.episode)}</span> 
                    {session.title && ` • ${session.title}`}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <h4 className="plex-media-title">
                {session.tmdbId ? (
                  <Link to={`/movies?tmdbId=${session.tmdbId}`} className="plex-media-link">
                    {session.title}
                  </Link>
                ) : (
                  session.title
                )}
              </h4>
              <p className="plex-media-subtitle">
                {session.tmdbId ? (
                  <Link to={`/movies?tmdbId=${session.tmdbId}`} className="plex-media-link-sub">
                    Movie
                  </Link>
                ) : (
                  'Movie'
                )}
              </p>
            </>
          )}

          {/* Time & Progress Segment */}
          <div className="plex-playback-progress-container">
            <span className="plex-time-current">{formatTime(interpolatedOffset)}</span>
            <div className="plex-progress-bar-bg">
              <div 
                className="plex-progress-bar-fill" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
            <span className="plex-time-duration">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Side: Dismiss Controls only */}
        <div className="plex-media-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {session.isManual && (
            <button 
              type="button" 
              className="plex-dismiss-btn" 
              onClick={handleCancelManualWatch}
              title="Cancel Watching"
              style={{ color: 'var(--danger)' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4-4H8V8h8v8z" />
              </svg>
            </button>
          )}
          <button 
            type="button" 
            className="plex-dismiss-btn" 
            onClick={() => setIsDismissed(true)}
            title="Dismiss Playback Overlay"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
};

export default PlexSessionWidget;

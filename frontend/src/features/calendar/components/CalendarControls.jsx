import React, { useState, useEffect } from 'react';
import { Sliders, Check } from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';

const CalendarControls = ({ store, isAdmin, isMobile }) => {
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => {
      setIsDisplayMenuOpen(false);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const {
    viewMode, setViewMode,
    mediaTypeFilter, setMediaTypeFilter,
    hideCollected, setHideCollected,
    hideWatched, setHideWatched,
    showCopyButton, setShowCopyButton,
    mobileSwipeMode, setMobileSwipeMode
  } = store;

  const renderDisplayOptionsContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Layout</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'month' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'week' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Week
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Type</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setMediaTypeFilter('all')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: mediaTypeFilter === 'all' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setMediaTypeFilter('shows')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: mediaTypeFilter === 'shows' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Shows
            </button>
            <button
              type="button"
              onClick={() => setMediaTypeFilter('movies')}
              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', background: mediaTypeFilter === 'movies' ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Movies
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Visibility</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                className="custom-checkbox-input"
                checked={hideCollected}
                onChange={() => setHideCollected(!hideCollected)}
              />
              <span className="custom-checkbox-box">
                <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
              </span>
              <span className="custom-checkbox-label">Hide Collected</span>
            </label>
            <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                className="custom-checkbox-input"
                checked={hideWatched}
                onChange={() => setHideWatched(!hideWatched)}
              />
              <span className="custom-checkbox-box">
                <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
              </span>
              <span className="custom-checkbox-label">Hide Watched</span>
            </label>
          </div>
        </div>

        {isAdmin && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Admin Options</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="custom-checkbox-input"
                  checked={showCopyButton}
                  onChange={() => setShowCopyButton(!showCopyButton)}
                />
                <span className="custom-checkbox-box">
                  <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
                </span>
                <span className="custom-checkbox-label">Show Copy Button</span>
              </label>
            </div>
          </div>
        )}

        {isMobile && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Mobile Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="custom-checkbox-container" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="custom-checkbox-input"
                  checked={mobileSwipeMode}
                  onChange={() => setMobileSwipeMode(!mobileSwipeMode)}
                />
                <span className="custom-checkbox-box">
                  <Check className="custom-checkbox-icon" size={12} strokeWidth={3} />
                </span>
                <span className="custom-checkbox-label">Swipe Actions</span>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="display-options-container" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-secondary display-options-btn"
        onClick={() => setIsDisplayMenuOpen(prev => !prev)}
      >
        <Sliders size={16} />
        <span className="display-options-text">Display Options</span>
      </button>

      {isDisplayMenuOpen && (
        isMobile ? (
          <MobileBottomSheet title="Display Options" onClose={() => setIsDisplayMenuOpen(false)}>
            {renderDisplayOptionsContent()}
          </MobileBottomSheet>
        ) : (
          <div style={{
            position: 'absolute',
            top: '44px',
            right: 0,
            zIndex: 101,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            padding: '20px',
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backdropFilter: 'blur(8px)'
          }}>
            {renderDisplayOptionsContent()}
          </div>
        )
      )}
    </div>
  );
};

export default CalendarControls;

import React from 'react';

const EventPopover = ({ activePopover, onMouseEnter, onMouseLeave, children }) => {
  if (!activePopover || typeof window === 'undefined') return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: (activePopover.rect.bottom + 200 > window.innerHeight) 
          ? Math.max(10, activePopover.rect.top - 220) 
          : activePopover.rect.bottom + 8,
        left: Math.max(10, Math.min(activePopover.rect.left, window.innerWidth - 310)),
        width: '300px',
        zIndex: 9999,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        borderRadius: '8px',
        background: 'var(--bg-main)'
      }}
    >
      {children}
    </div>
  );
};

export default EventPopover;

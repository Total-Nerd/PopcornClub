import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const MobileBottomSheet = ({ onClose, title, children, className }) => {
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Lock body scroll on mount, unlock on unmount
  useEffect(() => {
    document.body.classList.add('sheet-open');
    return () => {
      document.body.classList.remove('sheet-open');
    };
  }, []);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - touchStart;
    if (diff > 0) {
      setTouchCurrent(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (touchCurrent > 80) {
      onClose();
    }
    setTouchCurrent(0);
  };

  const sheetJSX = (
    <>
      <div 
        className={`mobile-sheet-backdrop ${className || ''}`}
        onClick={onClose} 
        style={{ touchAction: 'none' }}
      />
      <div
        className={`mobile-sheet-content ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: touchCurrent > 0 ? `translateY(${touchCurrent}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div 
          className="mobile-sheet-handle-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: 'grab', padding: '12px 0 20px 0', margin: '-12px 0 0 0' }}
        >
          <div className="mobile-sheet-handle" />
        </div>
        {title && <div className="mobile-sheet-title">{title}</div>}
        <div className="mobile-sheet-body">
          {children}
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(sheetJSX, document.body);
};

export default MobileBottomSheet;

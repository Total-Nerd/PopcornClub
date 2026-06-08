import React, { useState, useEffect, useRef } from 'react';

const LazyImage = ({ src, alt, className, style, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Debounce loading by 200ms to avoid loading images scrolled past quickly
            timeoutRef.current = setTimeout(() => {
              setShouldLoad(true);
            }, 200);
          } else {
            // Cancel loading if the element leaves the viewport before the timeout fires
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }
        });
      },
      {
        rootMargin: '100px', // Pre-load slightly before it enters the viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="lazy-image-container"
      style={{ 
        position: 'relative', 
        width: '100%', 
        aspectRatio: style?.aspectRatio || '2/3', 
        overflow: 'hidden',
        borderRadius: 'inherit'
      }}
      onClick={onClick}
    >
      {/* Shine effect skeleton placeholder */}
      {!loaded && (
        <div className="image-skeleton" />
      )}
      {shouldLoad && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{
            ...style,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease-in-out',
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
    </div>
  );
};

export default LazyImage;

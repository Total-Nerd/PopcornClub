import React, { useState, useEffect } from 'react';
import { X, RefreshCw, AlertCircle, Check } from 'lucide-react';
import api from '../api';

const ImageSelectorModal = ({ isOpen, onClose, mediaType, tmdbId, imageType, currentPath, onSelect }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
      setSelectedPath(currentPath || '');
      setError('');
    }
  }, [isOpen, tmdbId, imageType]);

  const fetchImages = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/media/${mediaType}/${tmdbId}/images`);
      // TMDB images returns backdrops and posters lists
      const list = imageType === 'poster' ? (res.data.posters || []) : (res.data.backdrops || []);
      setImages(list);
    } catch (err) {
      console.error('Failed to fetch alternate images:', err);
      setError(err.response?.data?.error || 'Failed to load options from TMDB.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = imageType === 'poster' ? { posterPath: selectedPath } : { backdropPath: selectedPath };
      await api.put(`/media/${mediaType}/${tmdbId}/images`, payload);
      onSelect(selectedPath);
      onClose();
    } catch (err) {
      console.error('Failed to save selected image:', err);
      setError(err.response?.data?.error || 'Failed to update selection in database.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="custom-modal-backdrop" onClick={onClose}>
      <div 
        className="custom-modal-content" 
        style={{ maxWidth: imageType === 'poster' ? '540px' : '720px', width: '90%' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <h3 style={{ margin: 0, fontWeight: '700' }}>
            Select Custom {imageType === 'poster' ? 'Poster' : 'Backdrop'}
          </h3>
          <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={onClose} disabled={saving}>
            <X size={20} />
          </button>
        </div>

        <div className="custom-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{ color: 'var(--danger)', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
              <RefreshCw className="spin" size={28} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching TMDB assets...</span>
            </div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
              No alternative {imageType === 'poster' ? 'posters' : 'backdrops'} found on TMDB for this title.
            </div>
          ) : (
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: imageType === 'poster' ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px'
              }}
            >
              {images.slice(0, 30).map((img, idx) => {
                const isSelected = img.file_path === selectedPath;
                const thumbUrl = imageType === 'poster' 
                  ? `https://image.tmdb.org/t/p/w185${img.file_path}`
                  : `https://image.tmdb.org/t/p/w300${img.file_path}`;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedPath(img.file_path)}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '3px solid ' + (isSelected ? 'var(--accent)' : 'transparent'),
                      boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                      transition: 'all 0.15s ease',
                      aspectRatio: imageType === 'poster' ? '2/3' : '16/9',
                      background: 'rgba(0,0,0,0.2)'
                    }}
                  >
                    <img 
                      src={thumbUrl} 
                      alt={`Option ${idx + 1}`} 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        opacity: isSelected ? 1 : 0.85
                      }} 
                    />
                    
                    {isSelected && (
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '6px', 
                          right: '6px', 
                          background: 'var(--accent)', 
                          color: '#fff', 
                          borderRadius: '50%', 
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="custom-modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose} 
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={loading || saving || !selectedPath}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saving && <RefreshCw className="spin" size={14} />}
            <span>Save Image Selection</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageSelectorModal;

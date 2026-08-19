import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeOff, X } from 'lucide-react';
import { useModal } from '../../../context/ModalContext';
import { useMovieStore } from '../store/useMovieStore';
import api from '../../../api';

const MovieHideModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { movieDetails } = useMovieStore();

  const [hideInCalendar, setHideInCalendar] = useState(true);
  const [hideInLibrary, setHideInLibrary] = useState(true);

  if (!isOpen || !movieDetails) return null;

  const handleHideMovie = async () => {
    try {
      await api.post('/media/hide', {
        tmdbId: parseInt(movieDetails.id),
        type: 'movie',
        title: movieDetails.title,
        overview: movieDetails.overview,
        releaseDate: movieDetails.release_date,
        posterPath: movieDetails.poster_path,
        hideInCalendar,
        hideInLibrary
      });
      onClose();
      showAlert('Movie hidden successfully', 'success');
      navigate('/');
    } catch (err) {
      console.error(err);
      showAlert('Failed to hide movie', 'error');
    }
  };

  return (
    <div className="custom-modal-backdrop" onClick={onClose}>
      <div className="custom-modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="custom-modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><EyeOff size={20} /> Hide Movie</h3>
          <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="custom-modal-body" style={{ padding: '24px' }}>
          <p style={{ marginTop: 0, marginBottom: '24px', color: 'var(--text-muted)' }}>
            Where would you like to hide <strong>{movieDetails?.title}</strong>? You can unhide it later from your User Settings.
          </p>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--overlay)', borderRadius: '8px', cursor: 'pointer', marginBottom: '12px' }}>
            <input 
              type="checkbox" 
              checked={hideInLibrary} 
              onChange={(e) => setHideInLibrary(e.target.checked)} 
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '500' }}>Hide in Media Library</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remove from movies view</span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--overlay)', borderRadius: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={hideInCalendar} 
              onChange={(e) => setHideInCalendar(e.target.checked)} 
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '500' }}>Hide in Calendar</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remove from calendar view</span>
            </div>
          </label>
        </div>
        <div className="custom-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={handleHideMovie}
            disabled={!hideInLibrary && !hideInCalendar}
          >
            Hide Movie
          </button>
        </div>
      </div>
    </div>
  );
};

export default MovieHideModal;

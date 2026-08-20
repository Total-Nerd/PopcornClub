import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, ExternalLink, Search, RefreshCw, History, Check } from 'lucide-react';
import { useMovieStore } from '../store/useMovieStore';
import { AuthContext } from '../../../context/AuthContext';
import { useModal } from '../../../context/ModalContext';
import api from '../../../api';
import RequestButton from '../../../components/RequestButton';
import MobileBottomSheet from '../../../components/MobileBottomSheet';

const MovieActionButtons = ({ onWatchOptions }) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useModal();
  const { user } = useContext(AuthContext);

  const {
    movieDetails,
    setMovieDetails,
    lists,
    listMemberships,
    handleToggleList,
    fetchRawData,
    setShowRawModal
  } = useMovieStore();

  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => setIsListDropdownOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen) {
        const container = event.target.closest('.info-dropdown-container');
        if (!container) {
          setIsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const isMovieInAnyList = () => {
    return Object.keys(listMemberships).length > 0;
  };

  const handleToggleCollection = async () => {
    if (!movieDetails) return;
    const isCurrentlyCollected = movieDetails.isCollected;

    if (isCurrentlyCollected) {
      const confirmed = await showConfirm(`Are you sure you want to remove entire movie "${movieDetails.title}" from your collection?`);
      if (!confirmed) return;
    }

    try {
      await api.post('/media/collect', {
        tmdbId: movieDetails.id,
        type: 'movie',
        title: movieDetails.title,
        remove: isCurrentlyCollected
      });

      setMovieDetails(prev => ({
        ...prev,
        isCollected: !isCurrentlyCollected
      }));
    } catch (err) {
      console.error('Failed to toggle collection:', err);
    }
  };

  const handleScanMedia = async () => {
    try {
      showAlert('Scanning folders for this movie...', 'info');
      const res = await api.post(`/media/scan/movie/${movieDetails.id}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        // Refresh movie details to display any new file path
        const detailsRes = await api.get(`/media/movie/${movieDetails.id}`);
        setMovieDetails(detailsRes.data);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  if (!movieDetails) return null;

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <button
        className={`btn ${!movieDetails.isCollected ? 'btn-secondary' : ''}`}
        style={{
          background: movieDetails.isCollected ? 'rgba(59, 130, 246, 0.15)' : '',
          color: movieDetails.isCollected ? '#60a5fa' : '',
          border: movieDetails.isCollected ? '1px solid rgba(59, 130, 246, 0.3)' : '',
          fontWeight: '600'
        }}
        onClick={handleToggleCollection}
      >
        <Plus size={18} style={{ transform: movieDetails.isCollected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
        <span>{movieDetails.isCollected ? 'Collected' : 'Collect'}</span>
      </button>

      <button
        className={`btn ${!movieDetails.isWatched ? 'btn-secondary' : ''}`}
        style={{
          background: movieDetails.isWatched ? 'rgba(16, 185, 129, 0.15)' : '',
          color: movieDetails.isWatched ? 'var(--success)' : '',
          border: movieDetails.isWatched ? '1px solid rgba(16, 185, 129, 0.3)' : '',
          fontWeight: '600'
        }}
        onClick={onWatchOptions}
      >
        {movieDetails.isWatched ? <Check size={18} /> : <Eye size={18} />}
        <span>{movieDetails.isWatched ? 'Watched' : 'Watch'}</span>
      </button>

      {!movieDetails.isCollected && (
        <RequestButton 
          tmdbId={movieDetails.id} 
          type="movie" 
          title={movieDetails.title} 
          initialRequested={movieDetails.isRequested}
        />
      )}

      <div className="info-dropdown-container show-dropdown-container">
        <button
          className="btn btn-secondary"
          style={{
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: isMovieInAnyList() ? 'rgba(59, 130, 246, 0.15)' : 'var(--overlay-subtle)',
            color: isMovieInAnyList() ? 'rgb(96, 165, 250)' : 'var(--text-main)',
            border: isMovieInAnyList() ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsListDropdownOpen(prev => !prev);
          }}
        >
          <Plus size={18} />
          <span>{isMovieInAnyList() ? 'Added to List' : 'Add to List'}</span>
        </button>
        {isListDropdownOpen && (
          <>
            <div className="info-dropdown-menu" onClick={e => e.stopPropagation()}>
              {lists.map(list => {
                const inList = listMemberships[list.id];
                return (
                  <label key={list.id} className="info-dropdown-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!inList}
                      onChange={() => handleToggleList(list.id, movieDetails.id, showAlert)}
                    />
                    {list.name}
                  </label>
                );
              })}
            </div>
            <MobileBottomSheet title="Add to List" onClose={() => setIsListDropdownOpen(false)}>
              {lists.map(list => {
                const inList = listMemberships[list.id];
                return (
                  <label key={list.id} className="mobile-sheet-option" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!inList}
                      onChange={() => handleToggleList(list.id, movieDetails.id, showAlert)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    {list.name}
                  </label>
                );
              })}
            </MobileBottomSheet>
          </>
        )}
      </div>

      {movieDetails.imdb_id && (
        <a
          href={`https://www.imdb.com/title/${movieDetails.imdb_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{
            background: '#f5c518',
            color: '#000000',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          IMDb <ExternalLink size={16} style={{ marginLeft: '6px' }} />
        </a>
      )}
      <a
        href={`https://www.themoviedb.org/movie/${movieDetails.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
        style={{
          background: '#01b4e4',
          color: '#ffffff',
          fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        TMDb <ExternalLink size={16} style={{ marginLeft: '6px' }} />
      </a>

      <div className="info-dropdown-container">
        <button
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', height: '100%' }}
          onClick={() => setIsDropdownOpen(prev => !prev)}
          title="More actions"
        >
          ...
        </button>
        {isDropdownOpen && (
          <>
            {/* Desktop Dropdown Menu */}
            <div className="info-dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="info-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleScanMedia();
                }}
              >
                <Search size={14} /> Scan for Media
              </button>
              <button
                className="info-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowRawModal(true);
                  fetchRawData(movieDetails.id);
                }}
              >
                <RefreshCw size={14} /> View Local Data
              </button>
              <button
                className="info-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate(`/history?type=movie&tmdbId=${movieDetails.id}&title=${encodeURIComponent(movieDetails.title)}`);
                }}
              >
                <History size={14} /> View Watch History
              </button>
            </div>

            {/* Mobile Bottom Sheet Menu */}
            <MobileBottomSheet title="Movie Options" onClose={() => setIsDropdownOpen(false)}>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleScanMedia();
                }}
              >
                <Search size={16} /> Scan for Media
              </button>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowRawModal(true);
                  fetchRawData(movieDetails.id);
                }}
              >
                <RefreshCw size={16} /> View Local Data
              </button>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate(`/history?type=movie&tmdbId=${movieDetails.id}&title=${encodeURIComponent(movieDetails.title)}`);
                }}
              >
                <History size={16} /> View Watch History
              </button>
            </MobileBottomSheet>
          </>
        )}
      </div>
    </div>
  );
};

export default MovieActionButtons;

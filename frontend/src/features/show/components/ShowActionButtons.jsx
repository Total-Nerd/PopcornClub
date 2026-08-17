import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, ExternalLink, Search, RefreshCw, History, Eye } from 'lucide-react';
import { useShowStore } from '../store/useShowStore';
import { AuthContext } from '../../../context/AuthContext';
import { useModal } from '../../../context/ModalContext';
import api from '../../../api';
import RequestButton from '../../../components/RequestButton';
import MobileBottomSheet from '../../../components/MobileBottomSheet';

const ShowActionButtons = ({ onWatchOptions, activeSeason }) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useModal();
  const { user } = useContext(AuthContext);

  const {
    showDetails,
    setShowDetails,
    lists,
    listMemberships,
    handleToggleList,
    fetchRawData,
    setShowRawModal,
    handleSelectSeason
  } = useShowStore();

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

  const isShowInAnyList = () => {
    return Object.keys(listMemberships).length > 0;
  };

  const handleToggleCollection = async () => {
    if (!showDetails) return;
    const isCurrentlyCollected = showDetails.isCollected;

    if (isCurrentlyCollected) {
      const confirmed = await showConfirm(`Are you sure you want to remove entire show "${showDetails.name}" and all its logs?`);
      if (!confirmed) return;
    }

    try {
      await api.post('/media/collect', {
        tmdbId: showDetails.id,
        type: 'tv',
        title: showDetails.name,
        remove: isCurrentlyCollected
      });

      setShowDetails(prev => ({
        ...prev,
        isCollected: !isCurrentlyCollected,
        collectedEpisodes: isCurrentlyCollected ? [] : prev.collectedEpisodes,
        watchedEpisodes: isCurrentlyCollected ? [] : prev.watchedEpisodes
      }));
    } catch (err) {
      console.error('Failed to toggle collection:', err);
    }
  };

  const handleScanShow = async () => {
    try {
      showAlert('Scanning folders for this show...', 'info');
      const res = await api.post(`/media/scan/tv/${showDetails.id}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        const detailsRes = await api.get(`/media/tv/${showDetails.id}`);
        setShowDetails(detailsRes.data);
        if (activeSeason) {
          handleSelectSeason(showDetails.id, activeSeason);
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  if (!showDetails) return null;

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <button
        className="btn"
        style={{
          background: showDetails.isCollected ? 'rgba(59, 130, 246, 0.15)' : 'var(--accent)',
          color: showDetails.isCollected ? '#60a5fa' : '#fff',
          border: showDetails.isCollected ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
          fontWeight: '600'
        }}
        onClick={handleToggleCollection}
      >
        <Plus size={18} style={{ transform: showDetails.isCollected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
        <span>{showDetails.isCollected ? 'Collected' : 'Collect'}</span>
      </button>

      {(() => {
        const watchedCount = showDetails.watchedEpisodes?.length || 0;
        const totalCount = showDetails.number_of_episodes || 0;
        const isAnyWatched = watchedCount > 0;
        const watchedPercent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
        
        return (
          <button
            className="btn btn-secondary"
            style={{
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: isAnyWatched ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
              background: isAnyWatched ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: isAnyWatched ? '#34d399' : 'var(--text-main)',
            }}
            onClick={onWatchOptions}
          >
            <Eye size={18} />
            <span>{isAnyWatched ? `Watched (${watchedPercent}%)` : 'Watch'}</span>
          </button>
        );
      })()}

      <div className="info-dropdown-container show-dropdown-container">
        <button
          className="btn btn-secondary"
          style={{
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: isShowInAnyList() ? 'rgba(59, 130, 246, 0.15)' : 'var(--overlay-subtle)',
            color: isShowInAnyList() ? 'rgb(96, 165, 250)' : 'var(--text-main)',
            border: isShowInAnyList() ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsListDropdownOpen(prev => !prev);
          }}
        >
          <Plus size={18} />
          <span>{isShowInAnyList() ? 'Added to List' : 'Add to List'}</span>
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
                      onChange={() => handleToggleList(list.id, showDetails.id, showAlert)}
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
                      onChange={() => handleToggleList(list.id, showDetails.id, showAlert)}
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

      {showDetails.imdb_id && (
        <a
          href={`https://www.imdb.com/title/${showDetails.imdb_id}`}
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
        href={`https://www.themoviedb.org/tv/${showDetails.id}`}
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

      {!showDetails.isCollected && (
          <RequestButton 
            tmdbId={showDetails.id} 
            type="tv" 
            title={showDetails.name} 
          />
      )}

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
                  handleScanShow();
                }}
              >
                <Search size={14} /> Scan for Media
              </button>
              <button
                className="info-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowRawModal(true);
                  fetchRawData(showDetails.id);
                }}
              >
                <RefreshCw size={14} /> View Local Data
              </button>
              <button
                className="info-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate(`/history?type=tv&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
                }}
              >
                <History size={14} /> View Watch History
              </button>
            </div>

            {/* Mobile Bottom Sheet Menu */}
            <MobileBottomSheet title="Show Options" onClose={() => setIsDropdownOpen(false)}>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleScanShow();
                }}
              >
                <Search size={16} /> Scan for Media
              </button>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowRawModal(true);
                  fetchRawData(showDetails.id);
                }}
              >
                <RefreshCw size={16} /> View Local Data
              </button>
              <button
                className="mobile-sheet-option"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate(`/history?type=tv&tmdbId=${showDetails.id}&title=${encodeURIComponent(showDetails.name)}`);
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

export default ShowActionButtons;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Film, Star, Plus, Eye, Trash2, Calendar, Clock, ExternalLink, RefreshCw, Check, EyeOff, X, History, Search, Edit } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import MobileBottomSheet from '../components/MobileBottomSheet';
import ImageSelectorModal from '../components/ImageSelectorModal';
import WatchOptionsModal from '../components/WatchOptionsModal';

const MovieDetails = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();

  const [movieDetails, setMovieDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [showRawModal, setShowRawModal] = useState(false);
  const [activeTrailerKey, setActiveTrailerKey] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [correctMode, setCorrectMode] = useState(false);
  const [correctingFile, setCorrectingFile] = useState(null);
  const [correctTitle, setCorrectTitle] = useState('');
  const [correctYear, setCorrectYear] = useState('');
  const [correctId, setCorrectId] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [listMemberships, setListMemberships] = useState({});
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);

  const [scrollY, setScrollY] = useState(0);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [imageSelectorType, setImageSelectorType] = useState('poster'); // 'poster' or 'backdrop'

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleImageSelected = (newPath) => {
    setMovieDetails(prev => {
      if (!prev) return prev;
      if (imageSelectorType === 'poster') {
        return { ...prev, poster_path: newPath };
      } else {
        return { ...prev, backdrop_path: newPath };
      }
    });
  };

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);

      const memberships = {};
      for (const list of res.data) {
        const itemInList = list.items.find(item => item.media.tmdbId === parseInt(tmdbId, 10));
        if (itemInList) {
          memberships[list.id] = { listItemId: itemInList.id, mediaId: itemInList.media.id };
        }
      }
      setListMemberships(memberships);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  };

  const isMovieInAnyList = () => {
    return Object.keys(listMemberships).length > 0;
  };

  const handleToggleList = async (listId) => {
    try {
      const current = listMemberships[listId];
      if (current) {
        const mediaId = current.mediaId || movieDetails.localId || movieDetails.id;
        await api.delete(`/lists/${listId}/items/${mediaId}`);
        setListMemberships(prev => {
          const updated = { ...prev };
          delete updated[listId];
          return updated;
        });
      } else {
        const payload = {
          tmdbId: parseInt(tmdbId, 10),
          type: 'movie',
          title: movieDetails.title,
          overview: movieDetails.overview,
          releaseDate: movieDetails.release_date,
          posterPath: movieDetails.poster_path
        };
        const res = await api.post(`/lists/${listId}/items`, payload);

        setListMemberships(prev => ({
          ...prev,
          [listId]: { listItemId: res.data.id, mediaId: res.data.mediaId }
        }));
      }
    } catch (err) {
      showAlert(`Failed to toggle list: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  useEffect(() => {
    const handleClose = () => setIsListDropdownOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    if (movieDetails) {
      fetchLists();
    }
  }, [movieDetails, tmdbId]);

  const parseFilenameFromPath = (filePath) => {
    const filename = filePath.split(/[/\\]/).pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;

    const yearMatch = nameWithoutExt.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
    let year = '';
    let title = nameWithoutExt;
    if (yearMatch) {
      year = yearMatch[1];
      title = nameWithoutExt.substring(0, nameWithoutExt.indexOf(yearMatch[0]));
    }

    const cleanTitleStr = title.replace(/[._-]/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|uhd|bluray|brrip|bdrip|dvdrip|webrip|web-dl|h264|x264|h265|x265|hevc|dd5\s*1|aac|dts|remux|xvid|divx)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { title: cleanTitleStr, year };
  };

  const fetchRawData = async () => {
    setLoadingRaw(true);
    setModalError('');
    try {
      const res = await api.get(`/media/raw/movie/${movieDetails.id}`);
      setRawData(res.data);
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to fetch raw media data.');
    } finally {
      setLoadingRaw(false);
    }
  };

  const handleSearchCorrection = async () => {
    if (!correctTitle) return;
    setSearching(true);
    setModalError('');
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(correctTitle)}`);
      let results = res.data.filter(item => item.media_type === 'movie');
      if (correctYear) {
        results = results.filter(item => {
          const itemYear = (item.release_date || '').substring(0, 4);
          return itemYear === correctYear.trim();
        });
      }
      setSearchResults(results);
    } catch (err) {
      setModalError(err.response?.data?.error || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const submitCorrection = async (targetNewTmdbId = null, targetImdbId = null) => {
    setCorrecting(true);
    setModalError('');
    try {
      const payload = {
        type: 'movie'
      };

      if (correctingFile) {
        payload.fileId = correctingFile.id;
      } else {
        payload.oldTmdbId = movieDetails?.localId || movieDetails?.id;
      }

      if (targetNewTmdbId) {
        payload.newTmdbId = targetNewTmdbId;
      } else if (targetImdbId) {
        payload.imdbId = targetImdbId;
      } else if (correctId) {
        if (correctId.trim().startsWith('tt')) {
          payload.imdbId = correctId.trim();
        } else {
          payload.newTmdbId = parseInt(correctId.trim(), 10);
        }
      } else if (correctTitle) {
        payload.title = correctTitle;
        if (correctYear) payload.releaseYear = correctYear;
      } else {
        setModalError('Please specify correction criteria.');
        setCorrecting(false);
        return;
      }

      const endpoint = correctingFile ? '/media/correct-file' : '/media/correct';
      const res = await api.post(endpoint, payload);
      showAlert(res.data.message || 'Correction successful!', 'success');
      setShowRawModal(false);
      setCorrectMode(false);
      setCorrectingFile(null);
      navigate(`/movies/${res.data.media.tmdbId}`, { replace: true });
      window.location.reload();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to apply correction.');
    } finally {
      setCorrecting(false);
    }
  };

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

  useEffect(() => {
    const fetchMovieDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await api.get(`/media/movie/${tmdbId}`);
        setMovieDetails(res.data);
      } catch (err) {
        console.error('Failed to fetch movie details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchMovieDetails();
  }, [tmdbId]);

  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);

  const handleWatchOptionsSelect = async ({ choice, watchedAt }) => {
    if (!movieDetails) return;
    try {
      if (choice === 'watching-now') {
        await api.post('/media/active-session', {
          tmdbId: movieDetails.id,
          type: 'movie',
          title: movieDetails.title,
          overview: movieDetails.overview,
          releaseDate: movieDetails.release_date,
          posterPath: movieDetails.poster_path
        });
        showAlert('Started watching now', 'info');
      } else if (choice === 'removed-last') {
        setMovieDetails(prev => ({
          ...prev,
          isWatched: watchedAt
        }));
        showAlert('Removed watch entry', 'info');
      } else {
        await api.post('/media/watch', {
          tmdbId: movieDetails.id,
          type: 'movie',
          title: movieDetails.title,
          overview: movieDetails.overview,
          releaseDate: movieDetails.release_date,
          posterPath: movieDetails.poster_path,
          watchedAt
        });
        setMovieDetails(prev => ({
          ...prev,
          isWatched: true
        }));
        showAlert('Marked as watched', 'success');
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
      showAlert('Failed to update watch status', 'error');
    }
  };

  const handleToggleWatch = async () => {
    if (!movieDetails) return;
    setIsWatchOptionsOpen(true);
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

  const handleForceRemove = async () => {
    const confirmed = await showConfirm(`Are you sure you want to remove this movie and all its logs from your database?`);
    if (!confirmed) {
      return;
    }
    try {
      let title = 'Unknown Movie';
      try {
        const rawRes = await api.get(`/media/raw/movie/${tmdbId}`);
        if (rawRes.data?.media?.title) {
          title = rawRes.data.media.title;
        }
      } catch (err) {
        console.warn('Failed to fetch raw movie details for deletion title fallback:', err);
      }

      await api.post('/media/force-remove', {
        tmdbId: parseInt(tmdbId, 10),
        type: 'movie'
      });
      showAlert('Movie removed successfully.', 'success');
      navigate('/movies');
    } catch (err) {
      console.error('Failed to remove movie:', err);
      showAlert('Failed to remove movie: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleScanMedia = async () => {
    try {
      showAlert('Scanning folders for this movie...', 'info');
      const res = await api.post(`/media/scan/movie/${tmdbId}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        // Refresh movie details to display any new file path
        const detailsRes = await api.get(`/media/movie/${tmdbId}`);
        setMovieDetails(detailsRes.data);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  if (loadingDetails) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Loading Movie specifications...</span>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Back Button */}
      {!movieDetails && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>
      )}

      {!movieDetails ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px auto', maxWidth: '600px' }}>
          <Film size={48} style={{ color: 'var(--danger)', marginBottom: '16px' }} />
          <h3>Failed to Load Movie Details</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The movie details could not be retrieved from TMDB.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> Go Back
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowRawModal(true); fetchRawData(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={16} /> Correct Match / Local Data
            </button>
            <button
              className="btn"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleForceRemove}
            >
              <Trash2 size={16} /> Remove Movie
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Backdrop Area */}
          <div className="details-backdrop-bg">
            <div
              className="details-backdrop-image"
              style={{
                backgroundImage: movieDetails.backdrop_path ? `url(https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path})` : 'none',
                filter: `blur(${Math.min(10, scrollY / 30)}px)`,
                transform: `scale(${1 + Math.min(10, scrollY / 30) / 100})`
              }}
            />
            <div
              className="details-backdrop-overlay"
              style={{
                opacity: Math.min(0.8, scrollY / 250)
              }}
            />
            <div className="details-backdrop-gradient" />
          </div>

          <div className="details-banner-spacer">
            <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', backdropFilter: 'blur(8px)', background: 'var(--bg-card)' }}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>

            <button
              className="edit-backdrop-btn"
              onClick={() => {
                setImageSelectorType('backdrop');
                setImageSelectorOpen(true);
              }}
            >
              <Edit size={16} />
              <span>Change Backdrop</span>
            </button>
          </div>

          {/* Content Layout */}
          <div className="details-content-wrapper">
            <div className="details-layout">

              {/* Left Column: Poster & Links */}
              <div className="details-left-col">
                <div
                  className="details-poster-container"
                  onClick={() => {
                    setImageSelectorType('poster');
                    setImageSelectorOpen(true);
                  }}
                >
                  <div className="details-poster-card">
                    {movieDetails.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`} alt={movieDetails.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '330px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        No Cover
                      </div>
                    )}
                  </div>
                  <div className="details-poster-edit-overlay">
                    <Edit size={24} />
                    <span>Change Poster</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata, Summary, Cast */}
              <div className="details-right-col">
                <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', lineHeight: '1.2' }}>{movieDetails.title}</h1>
                  {movieDetails.tagline && (
                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '20px' }}>"{movieDetails.tagline}"</p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                      <Star size={18} fill="#fbbf24" />
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{movieDetails.vote_average?.toFixed(1) || '0.0'}</span>
                    </div>

                    {movieDetails.runtime && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <Clock size={16} />
                        <span>{movieDetails.runtime} min</span>
                      </div>
                    )}

                    {movieDetails.release_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <Calendar size={16} />
                        <span>{new Date(movieDetails.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Genres */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    {movieDetails.genres?.map(g => (
                      <span key={g.id} style={{ padding: '6px 14px', background: 'var(--overlay-subtle)', borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                        {g.name}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      style={{
                        background: movieDetails.isWatched ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent)',
                        color: movieDetails.isWatched ? 'var(--success)' : '#fff',
                        border: movieDetails.isWatched ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
                        fontWeight: '600'
                      }}
                      onClick={handleToggleWatch}
                    >
                      {movieDetails.isWatched ? <EyeOff size={18} /> : <Eye size={18} />}
                      <span>{movieDetails.isWatched ? 'Watched' : 'Watch'}</span>
                    </button>

                    <button
                      className="btn"
                      style={{
                        background: movieDetails.isCollected ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent)',
                        color: movieDetails.isCollected ? 'var(--success)' : '#fff',
                        border: movieDetails.isCollected ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
                        fontWeight: '600'
                      }}
                      onClick={handleToggleCollection}
                    >
                      {movieDetails.isCollected ? <Plus size={18} style={{ transform: 'rotate(45deg)', transition: 'transform 0.2s' }} /> : <Plus size={18} />}
                      <span>{movieDetails.isCollected ? 'Collected' : 'Collect'}</span>
                    </button>

                    <div style={{ position: 'relative' }}>
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
                        <div style={{
                          position: 'absolute',
                          bottom: '48px',
                          left: 0,
                          zIndex: 10,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          padding: '8px',
                          minWidth: '180px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }} onClick={e => e.stopPropagation()}>
                          {lists.map(list => {
                            const inList = listMemberships[list.id];
                            return (
                              <label key={list.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px', color: 'var(--text-main)' }}>
                                <input
                                  type="checkbox"
                                  checked={!!inList}
                                  onChange={() => handleToggleList(list.id)}
                                />
                                {list.name}
                              </label>
                            );
                          })}
                        </div>
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
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={14} /> View Local Data
                            </button>
                            <button
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?search=${encodeURIComponent(movieDetails.title)}&type=movie&mediaId=${movieDetails.localId || ''}`);
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
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={16} /> View Local Data
                            </button>
                            <button
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?search=${encodeURIComponent(movieDetails.title)}&type=movie&mediaId=${movieDetails.localId || ''}`);
                              }}
                            >
                              <History size={16} /> View Watch History
                            </button>
                          </MobileBottomSheet>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overview */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Overview</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '1.05rem' }}>{movieDetails.overview || 'No overview available.'}</p>
                </div>

                {/* Cast Section */}
                {movieDetails.cast && movieDetails.cast.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Key Cast</h3>
                    <div className="details-cast-grid">
                      {movieDetails.cast.map(actor => (
                        <Link
                          key={actor.id}
                          to={`/person/${actor.id}`}
                          style={{
                            background: 'var(--overlay-subtle)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            textAlign: 'center',
                            display: 'block',
                            textDecoration: 'none',
                            color: 'inherit',
                            transition: 'transform 0.2s'
                          }}
                          className="hover-scale"
                        >
                          {actor.profile_path ? (
                            <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '120px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Profile</div>
                          )}
                          <div style={{ padding: '8px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={actor.name}>{actor.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={actor.character}>{actor.character}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trailers Section */}
                {movieDetails.videos && movieDetails.videos.filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')).length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Trailers & Clips</h3>
                    <div className="details-cast-grid">
                      {movieDetails.videos
                        .filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
                        .map(video => (
                          <div
                            key={video.id}
                            onClick={() => setActiveTrailerKey(video.key)}
                            style={{
                              background: 'var(--overlay-subtle)',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              border: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              position: 'relative',
                              flex: '0 0 200px',
                              minWidth: '200px'
                            }}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                              alt={video.name}
                              style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }}
                            />
                            {/* Play button overlay */}
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              left: '0',
                              right: '0',
                              height: '110px',
                              background: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'center',
                              transition: 'background 0.2s'
                            }} className="play-overlay">
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                              }}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                            <div style={{ padding: '8px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: '600', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }} title={video.name}>
                                {video.name}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {video.type}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Danger Zone / Remove Button at the bottom */}
          {movieDetails.isCollected && (
            <div style={{ marginTop: '48px', borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
                onClick={handleToggleCollection}
              >
                <Trash2 size={18} />
                <span>Remove Movie from Collection</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Local Data Modal */}
      {showRawModal && (
        <div className="custom-modal-backdrop" onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFile(null); setModalError(''); setSearchResults([]); }}>
          <div className="custom-modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontWeight: '700' }}>
                {correctMode ? 'Correct Match' : 'Movie Local Data & Correction'}
              </h3>
              <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFile(null); setModalError(''); setSearchResults([]); }}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body">
              {loadingRaw ? (
                <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                  <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching database records...</span>
                </div>
              ) : modalError && !correctMode && !searching ? (
                <div style={{ color: 'var(--danger)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                  {modalError}
                </div>
              ) : (
                <>
                  {!correctMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Local Database Media Record</h4>
                        {rawData?.media ? (
                          <pre className="raw-json-box">
                            {JSON.stringify(rawData.media, null, 2)}
                          </pre>
                        ) : (
                          <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No local media record found.</div>
                        )}
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Associated Local File Paths</h4>
                        {rawData?.files && rawData.files.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {rawData.files.map(f => (
                              <div key={f.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--overlay-subtle)' }}>
                                <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>{f.path}</code>
                                <button
                                  onClick={() => {
                                    setCorrectingFile(f);
                                    const parsed = parseFilenameFromPath(f.path);
                                    setCorrectTitle(parsed.title);
                                    const movieYear = movieDetails?.release_date ? movieDetails.release_date.substring(0, 4) : '';
                                    setCorrectYear(parsed.year && movieYear && parsed.year !== movieYear ? '' : parsed.year);
                                    setCorrectId('');
                                    setSearchResults([]);
                                    setModalError('');
                                    setCorrectMode(true);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '1rem', flexShrink: 0 }}
                                >
                                  Re-match Path
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--overlay-subtle)', borderRadius: '6px' }}>
                            No local files detected for this movie in the database.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {correctingFile && (
                        <div style={{
                          background: 'var(--overlay-subtle)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          fontSize: '0.85rem'
                        }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Correcting File Path:</div>
                          <code style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{correctingFile.path}</code>
                        </div>
                      )}

                      {!correctingFile && (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Search TMDB for the correct movie, or enter a target TMDB ID or IMDb ID (ttXXXXXXX) directly below.
                        </p>
                      )}

                      {modalError && (
                        <div style={{ color: 'var(--danger)', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px', fontSize: '0.88rem' }}>
                          {modalError}
                        </div>
                      )}

                      {/* Search fields */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Enter TMDB Search Title..."
                          value={correctTitle}
                          onChange={e => setCorrectTitle(e.target.value)}
                          className="input-field"
                          style={{ flex: 2, minWidth: '200px', padding: '8px 12px', fontSize: '0.9rem' }}
                        />
                        <input
                          type="number"
                          placeholder="Year (optional)"
                          value={correctYear}
                          onChange={e => setCorrectYear(e.target.value)}
                          className="input-field"
                          style={{ flex: 1, minWidth: '100px', padding: '8px 12px', fontSize: '0.9rem' }}
                        />
                        <button
                          onClick={handleSearchCorrection}
                          disabled={searching || correcting}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                        >
                          {searching ? <RefreshCw className="spin" size={16} /> : <Search size={16} />}
                          <span>Search</span>
                        </button>
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                          {searchResults.map((result) => (
                            <div
                              key={result.id}
                              onClick={() => submitCorrection(result.id)}
                              style={{ display: 'flex', gap: '12px', padding: '8px', borderRadius: '6px', background: 'var(--overlay-subtle)', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                              className="hover-bg"
                            >
                              <div style={{ width: '40px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-input)', flexShrink: 0 }}>
                                {result.poster_path && (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                    alt={result.title || result.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                )}
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                  {result.title || result.name}
                                </div>
                                <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {(result.release_date || result.first_air_date || '').substring(0, 4)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manual ID Input */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>Or enter manual TMDB ID or IMDb ID (tt...)</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="e.g. 27205 or tt1375666"
                            value={correctId}
                            onChange={e => setCorrectId(e.target.value)}
                            className="input-field"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
                          />
                          <button
                            onClick={() => submitCorrection()}
                            disabled={correcting || (!correctId.trim() && !correctTitle.trim())}
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px' }}
                          >
                            {correcting ? <RefreshCw className="spin" size={16} /> : 'Apply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="custom-modal-footer">
              {!correctMode ? (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setCorrectingFile(null);
                      setCorrectTitle(movieDetails?.title || '');
                      const movieYear = movieDetails?.release_date ? movieDetails.release_date.substring(0, 4) : '';
                      setCorrectYear(movieYear);
                      setCorrectId('');
                      setSearchResults([]);
                      setModalError('');
                      setCorrectMode(true);
                    }}
                  >
                    Correct Match
                  </button>
                  <button className="btn btn-primary" onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFile(null); setModalError(''); setSearchResults([]); }}>
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => { setCorrectMode(false); setCorrectingFile(null); setModalError(''); setSearchResults([]); }}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-bg:hover {
          background: var(--overlay-medium) !important;
          border-color: var(--accent) !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {movieDetails && (
        <ImageSelectorModal
          isOpen={imageSelectorOpen}
          onClose={() => setImageSelectorOpen(false)}
          mediaType="movie"
          tmdbId={movieDetails.id}
          imageType={imageSelectorType}
          currentPath={imageSelectorType === 'poster' ? movieDetails.poster_path : movieDetails.backdrop_path}
          onSelect={handleImageSelected}
        />
      )}

      {activeTrailerKey && (
        <div className="custom-modal-backdrop" onClick={() => setActiveTrailerKey(null)}>
          <div className="custom-modal-content" style={{ maxWidth: '800px', width: '95vw', padding: '0', background: '#000', aspectRatio: '16/9', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${activeTrailerKey}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
            ></iframe>
          </div>
        </div>
      )}

      {movieDetails && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={{
            tmdbId: movieDetails.id,
            type: 'movie',
            title: movieDetails.title,
            overview: movieDetails.overview,
            releaseDate: movieDetails.release_date,
            posterPath: movieDetails.poster_path,
            isWatched: movieDetails.isWatched
          }}
          onSelect={handleWatchOptionsSelect}
          onWatchStatusChange={(newIsWatched) => setMovieDetails(prev => ({ ...prev, isWatched: newIsWatched }))}
        />
      )}
    </div>
  );
};

export default MovieDetails;

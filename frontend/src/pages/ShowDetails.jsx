import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Tv, Star, Plus, Eye, Trash2, Calendar, ExternalLink, RefreshCw, X, History, Search, Edit } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import MobileBottomSheet from '../components/MobileBottomSheet';
import ImageSelectorModal from '../components/ImageSelectorModal';
import WatchOptionsModal from '../components/WatchOptionsModal';

const ShowDetails = () => {
  const { tmdbId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = useModal();

  const [showDetails, setShowDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [showRawModal, setShowRawModal] = useState(false);
  const [showSeasonRawModal, setShowSeasonRawModal] = useState(false);
  const [rawEpisode, setRawEpisode] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [correctMode, setCorrectMode] = useState(false);
  const [correctingFiles, setCorrectingFiles] = useState([]);
  const [selectedFilesForRematch, setSelectedFilesForRematch] = useState([]);
  const [correctTitle, setCorrectTitle] = useState('');
  const [correctYear, setCorrectYear] = useState('');
  const [correctId, setCorrectId] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTrailerKey, setActiveTrailerKey] = useState(null);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
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
    setShowDetails(prev => {
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

  const isShowInAnyList = () => {
    return Object.keys(listMemberships).length > 0;
  };

  const handleToggleList = async (listId) => {
    try {
      const current = listMemberships[listId];
      if (current) {
        const mediaId = current.mediaId || showDetails.localId || showDetails.id;
        await api.delete(`/lists/${listId}/items/${mediaId}`);
        setListMemberships(prev => {
          const updated = { ...prev };
          delete updated[listId];
          return updated;
        });
      } else {
        const payload = {
          tmdbId: parseInt(tmdbId, 10),
          type: 'tv',
          title: showDetails.name,
          overview: showDetails.overview,
          releaseDate: showDetails.first_air_date,
          posterPath: showDetails.poster_path
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
    if (showDetails) {
      fetchLists();
    }
  }, [showDetails, tmdbId]);

  const parsePathForRematch = (filePath) => {
    const parts = filePath.split(/[/\\]/).filter(Boolean);
    let targetName = parts.pop() || '';
    
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!parts[i].toLowerCase().includes('season') && !parts[i].toLowerCase().match(/specials?/i)) {
        targetName = parts[i];
        break;
      }
    }
    
    const tmdbMatch = targetName.match(/\{tmdb-(\d+)\}/i);
    let tmdbId = '';
    if (tmdbMatch) {
      tmdbId = tmdbMatch[1];
      targetName = targetName.replace(tmdbMatch[0], '').trim();
    }

    const yearMatch = targetName.match(/(?:\(|\[)(\d{4})(?:[\s,\]\)]|$)/);
    let year = '';
    let title = targetName;
    if (yearMatch) {
      year = yearMatch[1];
      title = targetName.substring(0, targetName.indexOf(yearMatch[0]));
    }

    const cleanTitleStr = title.replace(/[._-]/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|uhd|bluray|brrip|bdrip|dvdrip|webrip|web-dl|h264|x264|h265|x265|hevc|dd5\s*1|aac|dts|remux|xvid|divx)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { title: cleanTitleStr, year, tmdbId };
  };

  const startFileReMatch = (files) => {
    setShowSeasonRawModal(false);
    setRawEpisode(null);
    setShowRawModal(true);
    setCorrectingFiles(files);
    const parsed = parsePathForRematch(files[0].path);
    setCorrectTitle(parsed.title);
    const showYear = showDetails?.first_air_date ? showDetails.first_air_date.substring(0, 4) : '';
    setCorrectYear(parsed.year && showYear && parsed.year !== showYear ? '' : parsed.year);
    setCorrectId(parsed.tmdbId || '');
    setSearchResults([]);
    setModalError('');
    setCorrectMode(true);
  };

  const fetchRawData = async () => {
    setLoadingRaw(true);
    setModalError('');
    try {
      const res = await api.get(`/media/raw/tv/${tmdbId}`);
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
      let results = res.data.filter(item => item.media_type === 'tv');
      if (correctYear) {
        results = results.filter(item => {
          const itemYear = (item.first_air_date || '').substring(0, 4);
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
        type: 'tv'
      };

      if (correctingFiles.length > 0) {
        payload.fileIds = correctingFiles.map(f => f.id);
      } else {
        payload.oldTmdbId = showDetails?.localId || tmdbId;
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

      const endpoint = correctingFiles.length > 0 ? '/media/correct-file' : '/media/correct';
      const res = await api.post(endpoint, payload);
      showAlert(res.data.message || 'Correction successful!', 'success');
      
      if (correctingFiles.length > 0) {
        setCorrectMode(false);
        setCorrectingFiles([]);
        setSelectedFilesForRematch([]);
        fetchRawData();
      } else {
        setShowRawModal(false);
        setCorrectMode(false);
        setCorrectingFiles([]);
        setSelectedFilesForRematch([]);
        navigate(`/shows/${res.data.media.tmdbId}`, { replace: true });
        window.location.reload();
      }
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to apply correction.');
    } finally {
      setCorrecting(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen) {
        const container = event.target.closest('.show-dropdown-container');
        if (!container) {
          setIsDropdownOpen(false);
        }
      }
      if (isSeasonDropdownOpen) {
        const container = event.target.closest('.season-dropdown-container');
        if (!container) {
          setIsSeasonDropdownOpen(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen, isSeasonDropdownOpen]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState({});
  const [activeEpisodeMenu, setActiveEpisodeMenu] = useState(null);

  // Swipe gesture touch states removed (now handled by MobileBottomSheet component)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeEpisodeMenu !== null) {
        const container = event.target.closest('.episode-dropdown-container');
        if (!container) {
          setActiveEpisodeMenu(null);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeEpisodeMenu]);

  const toggleEpisodeExpand = (episodeId) => {
    setExpandedEpisodes(prev => ({
      ...prev,
      [episodeId]: !prev[episodeId]
    }));
  };

  useEffect(() => {
    const fetchShowDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(res.data);

        // Determine which season to select:
        // 1. From URL search params if present (e.g. ?season=2)
        // 2. First available season with season_number > 0
        // 3. Fallback to first season in the list
        const queryParams = new URLSearchParams(location.search);
        const urlSeason = queryParams.get('season');

        let seasonToSelect = urlSeason ? parseInt(urlSeason, 10) : null;

        if (seasonToSelect === null || isNaN(seasonToSelect)) {
          const defaultSeason = res.data.seasons?.find(s => s.season_number > 0) || res.data.seasons?.[0];
          seasonToSelect = defaultSeason ? defaultSeason.season_number : 1;
        }

        setActiveSeason(seasonToSelect);
        fetchSeasonEpisodes(tmdbId, seasonToSelect);
      } catch (err) {
        console.error('Failed to fetch TV details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchShowDetails();
  }, [tmdbId]);

  useEffect(() => {
    if (!loadingSeason && seasonEpisodes.length > 0) {
      const queryParams = new URLSearchParams(location.search);
      const urlEpisode = queryParams.get('episode');
      if (urlEpisode) {
        const episodeNum = parseInt(urlEpisode, 10);
        const epObj = seasonEpisodes.find(e => e.episode_number === episodeNum);
        if (epObj) {
          // Expand description first to achieve full layout height
          setExpandedEpisodes(prev => ({ ...prev, [epObj.id]: true }));

          // Scroll and highlight after DOM layout adjusts to expanded state
          setTimeout(() => {
            const element = document.getElementById(`episode-${episodeNum}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('episode-card-highlighted');
              setTimeout(() => {
                element.classList.remove('episode-card-highlighted');
              }, 3000);
            }
          }, 150);
        }
      }
    }
  }, [loadingSeason, seasonEpisodes, location.search]);

  const fetchSeasonEpisodes = async (id, seasonNumber) => {
    setLoadingSeason(true);
    try {
      const res = await api.get(`/media/tv/${id}/season/${seasonNumber}`);
      setSeasonEpisodes(res.data.episodes || []);
    } catch (err) {
      console.error('Failed to fetch season episodes:', err);
      setSeasonEpisodes([]);
    } finally {
      setLoadingSeason(false);
    }
  };

  const handleSelectSeason = (seasonNumber) => {
    setActiveSeason(seasonNumber);
    fetchSeasonEpisodes(tmdbId, seasonNumber);

    // Update URL query parameters without reloading
    const newUrl = `${window.location.pathname}?season=${seasonNumber}`;
    window.history.replaceState({}, '', newUrl);
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
        // Reset episode logs local counts if removed
        collectedEpisodes: isCurrentlyCollected ? [] : prev.collectedEpisodes,
        watchedEpisodes: isCurrentlyCollected ? [] : prev.watchedEpisodes
      }));

      // Refresh episode list to clear checkboxes if removing
      if (isCurrentlyCollected) {
        setSeasonEpisodes(prev => prev.map(ep => ({ ...ep, isCollected: false, isWatched: false })));
      }
    } catch (err) {
      console.error('Failed to toggle show collection:', err);
    }
  };

  const handleForceRemove = async () => {
    const confirmed = await showConfirm(`Are you sure you want to remove this show and all its logs from your database?`);
    if (!confirmed) {
      return;
    }
    try {
      let title = 'Unknown TV Show';
      try {
        const rawRes = await api.get(`/media/raw/tv/${tmdbId}`);
        if (rawRes.data?.media?.title) {
          title = rawRes.data.media.title;
        }
      } catch (err) {
        console.warn('Failed to fetch raw TV show details for deletion title fallback:', err);
      }

      await api.post('/media/force-remove', {
        tmdbId: parseInt(tmdbId, 10),
        type: 'tv'
      });
      showAlert('Show removed successfully.', 'success');
      navigate('/shows');
    } catch (err) {
      console.error('Failed to remove show:', err);
      showAlert('Failed to remove show: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleScanShow = async () => {
    try {
      showAlert('Scanning folders for this show...', 'info');
      const res = await api.post(`/media/scan/tv/${tmdbId}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        // Refresh show details to display any new file path / episodes
        const detailsRes = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(detailsRes.data);
        if (activeSeason) {
          handleSelectSeason(activeSeason);
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleScanSeason = async () => {
    if (!activeSeason) return;
    try {
      showAlert(`Scanning folders for Season ${activeSeason}...`, 'info');
      const res = await api.post(`/media/scan/tv/${tmdbId}?season=${activeSeason}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        // Refresh show details and season episodes
        const detailsRes = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(detailsRes.data);
        handleSelectSeason(activeSeason);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleScanEpisode = async (episodeNumber) => {
    if (!activeSeason) return;
    try {
      showAlert(`Scanning folders for Season ${activeSeason} Episode ${episodeNumber}...`, 'info');
      const res = await api.post(`/media/scan/tv/${tmdbId}?season=${activeSeason}&episode=${episodeNumber}`);
      if (res.data.success) {
        showAlert(res.data.message || 'Scan completed successfully.', 'success');
        // Refresh show details and season episodes
        const detailsRes = await api.get(`/media/tv/${tmdbId}`);
        setShowDetails(detailsRes.data);
        handleSelectSeason(activeSeason);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showAlert(`Scan failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const [isWatchOptionsOpen, setIsWatchOptionsOpen] = useState(false);
  const [watchOptionsMedia, setWatchOptionsMedia] = useState(null);
  const [activeWatchEpisode, setActiveWatchEpisode] = useState(null);

  const handleWatchOptionsSelect = async ({ choice, watchedAt }) => {
    if (!activeWatchEpisode || !showDetails) return;
    const episode = activeWatchEpisode;
    try {
      if (choice === 'watching-now') {
        await api.post('/media/active-session', {
          tmdbId: showDetails.id,
          type: 'episode',
          title: episode.name,
          overview: episode.overview,
          releaseDate: episode.air_date,
          posterPath: episode.still_path,
          season: episode.season_number,
          episode: episode.episode_number,
          grandparentTitle: showDetails.name,
          parentTitle: `Season ${episode.season_number}`
        });
        showAlert('Started watching now', 'info');
      } else if (choice === 'removed-last') {
        // Update episodes array in local state
        setSeasonEpisodes(prev => prev.map(ep =>
          ep.id === episode.id
            ? { ...ep, isWatched: watchedAt }
            : ep
        ));

        // Update showDetails counts
        setShowDetails(prev => {
          let updatedWatched = [...prev.watchedEpisodes];
          if (!watchedAt) {
            updatedWatched = updatedWatched.filter(x => !(x.season === episode.season_number && x.episode === episode.episode_number));
          }
          return {
            ...prev,
            watchedEpisodes: updatedWatched
          };
        });
        showAlert('Removed watch entry', 'info');
      } else {
        await api.post('/media/episode/watch', {
          tmdbId: showDetails.id,
          season: episode.season_number,
          episode: episode.episode_number,
          watched: true,
          title: showDetails.name,
          posterPath: showDetails.poster_path,
          watchedAt
        });

        // Update episodes array in local state
        setSeasonEpisodes(prev => prev.map(ep =>
          ep.id === episode.id
            ? { ...ep, isWatched: true }
            : ep
        ));

        // Update showDetails counts
        setShowDetails(prev => {
          let updatedWatched = [...prev.watchedEpisodes];
          const exists = updatedWatched.some(x => x.season === episode.season_number && x.episode === episode.episode_number);
          if (!exists) {
            updatedWatched.push({ season: episode.season_number, episode: episode.episode_number });
          }

          return {
            ...prev,
            isCollected: true, // Auto-collect show
            watchedEpisodes: updatedWatched
          };
        });

        showAlert('Marked as watched', 'success');
      }
    } catch (err) {
      console.error('Failed to log episode watch:', err);
      showAlert('Failed to update watch status', 'error');
    }
  };

  const handleEpisodeToggle = async (action, episode) => {
    const isWatched = action === 'watch';
    const currentVal = isWatched ? episode.isWatched : episode.isCollected;
    const newVal = !currentVal;

    if (isWatched) {
      setActiveWatchEpisode(episode);
      setWatchOptionsMedia({
        tmdbId: showDetails.id,
        type: 'episode',
        title: `Ep ${episode.episode_number}. ${episode.name}`,
        overview: episode.overview,
        releaseDate: episode.air_date || episode.airDateTime,
        posterPath: episode.still_path,
        season: episode.season_number,
        episode: episode.episode_number,
        grandparentTitle: showDetails.name,
        parentTitle: `Season ${episode.season_number}`,
        isWatched: episode.isWatched
      });
      setIsWatchOptionsOpen(true);
      return;
    }

    try {
      await api.post(`/media/episode/${action}`, {
        tmdbId: showDetails.id,
        season: episode.season_number,
        episode: episode.episode_number,
        [isWatched ? 'watched' : 'collected']: newVal,
        title: showDetails.name,
        posterPath: showDetails.poster_path
      });

      // Update episodes array in local state
      setSeasonEpisodes(prev => prev.map(ep =>
        ep.id === episode.id
          ? { ...ep, [isWatched ? 'isWatched' : 'isCollected']: newVal }
          : ep
      ));

      // Update showDetails counts
      setShowDetails(prev => {
        let updatedWatched = [...prev.watchedEpisodes];
        let updatedCollected = [...prev.collectedEpisodes];

        if (isWatched) {
          if (newVal) {
            updatedWatched.push({ season: episode.season_number, episode: episode.episode_number });
          } else {
            updatedWatched = updatedWatched.filter(x => !(x.season === episode.season_number && x.episode === episode.episode_number));
          }
        } else {
          if (newVal) {
            updatedCollected.push({ season: episode.season_number, episode: episode.episode_number });
          } else {
            updatedCollected = updatedCollected.filter(x => !(x.season === episode.season_number && x.episode === episode.episode_number));
          }
        }

        return {
          ...prev,
          isCollected: true, // Auto-collect show if any episode is toggled
          watchedEpisodes: updatedWatched,
          collectedEpisodes: updatedCollected
        };
      });

    } catch (err) {
      console.error(`Failed to toggle episode ${action}:`, err);
    }
  };

  if (loadingDetails) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Loading TV Show specifications...</span>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Back Button & Header */}
      {!showDetails && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>
      )}

      {!showDetails ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px auto', maxWidth: '600px' }}>
          <Tv size={48} style={{ color: 'var(--danger)', marginBottom: '16px' }} />
          <h3>Failed to Load Show Details</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The TV show details could not be retrieved from TMDB.</p>
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
              <Trash2 size={16} /> Remove Show
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
                backgroundImage: showDetails.backdrop_path ? `url(https://image.tmdb.org/t/p/w1280${showDetails.backdrop_path})` : 'none',
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

              {/* Left Column: Poster */}
              <div className="details-left-col">
                <div
                  className="details-poster-container"
                  onClick={() => {
                    setImageSelectorType('poster');
                    setImageSelectorOpen(true);
                  }}
                >
                  <div className="details-poster-card">
                    {showDetails.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${showDetails.poster_path}`} alt={showDetails.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
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

              {/* Right Column: Metadata, Summary, Cast, Seasons */}
              <div className="details-right-col">
                <div>
                  <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', lineHeight: '1.2' }}>{showDetails.name}</h1>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                      <Star size={18} fill="#fbbf24" />
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{showDetails.vote_average?.toFixed(1) || '0.0'}</span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {showDetails.number_of_seasons} Seasons • {showDetails.number_of_episodes} Episodes
                    </div>

                    {showDetails.first_air_date && (
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        First Aired: {new Date(showDetails.first_air_date).getFullYear()}
                      </div>
                    )}
                  </div>

                  {/* Genres */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    {showDetails.genres?.map(g => (
                      <span key={g.id} style={{ padding: '6px 14px', background: 'var(--overlay-subtle)', borderRadius: '16px', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '500' }}>
                        {g.name}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!showDetails.isCollected && (
                      <button
                        className="btn"
                        style={{
                          background: 'var(--accent)',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                        onClick={handleToggleCollection}
                      >
                        <Plus size={18} />
                        <span>Add to Collection</span>
                      </button>
                    )}

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
                                    onChange={() => handleToggleList(list.id)}
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
                                    onChange={() => handleToggleList(list.id)}
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

                    {showDetails.external_ids?.imdb_id && (
                      <a
                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
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

                    <div className="info-dropdown-container show-dropdown-container">
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
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={14} /> View Local Data
                            </button>
                            <button
                              className="info-dropdown-item"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&mediaId=${showDetails.localId || ''}`);
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
                                fetchRawData();
                              }}
                            >
                              <RefreshCw size={16} /> View Local Data
                            </button>
                            <button
                              className="mobile-sheet-option"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&mediaId=${showDetails.localId || ''}`);
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
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '1.05rem' }}>{showDetails.overview || 'No overview available.'}</p>
                </div>

                {/* Cast Section */}
                {showDetails.cast && showDetails.cast.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Key Cast</h3>
                    <div className="details-cast-grid">
                      {showDetails.cast.map(actor => (
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
                {showDetails.videos && showDetails.videos.filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')).length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontWeight: '600' }}>Trailers & Clips</h3>
                    <div className="details-cast-grid">
                      {showDetails.videos
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

                {/* Seasons Selection row */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Seasons</h3>
                    {activeSeason && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="info-dropdown-container season-dropdown-container">
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '1rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', minWidth: '0', height: 'auto', border: '1px solid var(--border-color)' }}
                            onClick={() => setIsSeasonDropdownOpen(prev => !prev)}
                            title="Season options"
                          >
                            ...
                          </button>
                          {isSeasonDropdownOpen && (
                            <>
                              {/* Desktop Dropdown Menu */}
                              <div className="info-dropdown-menu" style={{ right: 0, left: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    handleScanSeason();
                                  }}
                                >
                                  <Search size={12} /> Scan Season for Media
                                </button>
                                <a
                                  href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${activeSeason}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="info-dropdown-item"
                                  onClick={() => setIsSeasonDropdownOpen(false)}
                                >
                                  <ExternalLink size={12} /> View Season on TMDb
                                </a>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setShowSeasonRawModal(true);
                                    fetchRawData();
                                  }}
                                >
                                  <RefreshCw size={12} /> View Season Local Data
                                </button>
                                <button
                                  className="info-dropdown-item"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&season=${activeSeason}&mediaId=${showDetails.localId || ''}`);
                                  }}
                                >
                                  <History size={12} /> View Season Watch History
                                </button>
                              </div>

                              {/* Mobile Bottom Sheet Menu */}
                              <MobileBottomSheet title={`Season ${activeSeason} Options`} onClose={() => setIsSeasonDropdownOpen(false)}>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    handleScanSeason();
                                  }}
                                >
                                  <Search size={16} /> Scan Season for Media
                                </button>
                                <a
                                  href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${activeSeason}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mobile-sheet-option"
                                  onClick={() => setIsSeasonDropdownOpen(false)}
                                >
                                  <ExternalLink size={16} /> View Season on TMDb
                                </a>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    setShowSeasonRawModal(true);
                                    fetchRawData();
                                  }}
                                >
                                  <RefreshCw size={16} /> View Season Local Data
                                </button>
                                <button
                                  className="mobile-sheet-option"
                                  onClick={() => {
                                    setIsSeasonDropdownOpen(false);
                                    navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&season=${activeSeason}&mediaId=${showDetails.localId || ''}`);
                                  }}
                                >
                                  <History size={16} /> View Season Watch History
                                </button>
                              </MobileBottomSheet>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    className="seasons-scroll-container"
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '12px',
                      marginBottom: '8px',
                      width: '100%',
                      maxWidth: '100%'
                    }}
                  >
                    {showDetails.seasons?.filter(s => s.season_number > 0).map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSeason(s.season_number)}
                        className="btn"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          borderRadius: '20px',
                          background: activeSeason === s.season_number ? 'var(--accent)' : 'var(--overlay-subtle)',
                          color: activeSeason === s.season_number ? '#fff' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          border: activeSeason === s.season_number ? 'none' : '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                      >
                        Season {s.season_number} ({s.episode_count} Ep)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Episodes List */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px' }}>Season {activeSeason} Episodes</h3>

                  {loadingSeason ? (
                    <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center' }}>
                      <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                    </div>
                  ) : seasonEpisodes.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No episodes found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {seasonEpisodes.map(ep => (
                        <div
                          key={ep.id}
                          id={`episode-${ep.episode_number}`}
                          className={`episode-card ${ep.isWatched ? 'is-watched' : ''}`}
                        >
                          {/* Episode Thumbnail */}
                          <div className="episode-thumbnail">
                            {ep.still_path ? (
                              <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={ep.name} loading="lazy" />
                            ) : (
                              <div className="episode-thumbnail-fallback">
                                <span>No Image</span>
                              </div>
                            )}
                          </div>

                          <div className="episode-card-body">
                            <div className="episode-card-header">
                              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                                Ep {ep.episode_number}. {ep.name}
                              </h4>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {ep.airDateTime ? (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }} title={`UTC: ${ep.airDateTime}`}>
                                    <Calendar size={12} />
                                    <span>{new Date(ep.airDateTime).toLocaleDateString()} at {new Date(ep.airDateTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                  </span>
                                ) : ep.air_date ? (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} />
                                    <span>{new Date(ep.air_date).toLocaleDateString()}</span>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p
                              className={`episode-description-text ${!expandedEpisodes[ep.id] ? 'collapsed' : ''}`}
                              onClick={() => toggleEpisodeExpand(ep.id)}
                              title="Click to expand/collapse"
                            >
                              {ep.overview || 'No description available for this episode.'}
                            </p>
                          </div>

                          {/* Quick toggles */}
                          <div className="episode-button-group">
                            <button
                              onClick={() => handleEpisodeToggle('collect', ep)}
                              className="btn btn-secondary"
                              style={{
                                background: ep.isCollected ? 'rgba(16, 185, 129, 0.2)' : 'var(--overlay-subtle)',
                                color: ep.isCollected ? 'var(--success)' : 'var(--text-muted)',
                                border: ep.isCollected ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent'
                              }}
                              title={ep.isCollected ? "Remove collected" : "Add to collection"}
                            >
                              <Plus size={16} style={{ transform: ep.isCollected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                              <span>{ep.isCollected ? 'Collected' : 'Collect'}</span>
                            </button>

                            <button
                              onClick={() => handleEpisodeToggle('watch', ep)}
                              className="btn btn-secondary"
                              style={{
                                background: ep.isWatched ? 'rgba(59, 130, 246, 0.2)' : 'var(--overlay-subtle)',
                                color: ep.isWatched ? 'var(--accent)' : 'var(--text-muted)',
                                border: ep.isWatched ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent'
                              }}
                              title={ep.isWatched ? "Watched" : "Watch"}
                            >
                              <Eye size={16} />
                              <span>{ep.isWatched ? 'Watched' : 'Watch'}</span>
                            </button>

                            <div className="episode-dropdown-container">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEpisodeMenu(activeEpisodeMenu === ep.id ? null : ep.id);
                                }}
                                className="btn btn-secondary episode-menu-btn"
                                title="More options"
                              >
                                ...
                              </button>

                              {activeEpisodeMenu === ep.id && (
                                <>
                                  {/* Desktop Dropdown Menu */}
                                  <div className="episode-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    {showDetails.external_ids?.imdb_id && (
                                      <a
                                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="episode-dropdown-item"
                                        onClick={() => setActiveEpisodeMenu(null)}
                                      >
                                        <ExternalLink size={14} /> IMDb
                                      </a>
                                    )}
                                    <a
                                      href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${ep.season_number}/episode/${ep.episode_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="episode-dropdown-item"
                                      onClick={() => setActiveEpisodeMenu(null)}
                                    >
                                      <ExternalLink size={14} /> TMDb
                                    </a>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        handleScanEpisode(ep.episode_number);
                                      }}
                                    >
                                      <Search size={14} /> Scan for Media
                                    </button>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        setRawEpisode(ep);
                                        fetchRawData();
                                      }}
                                    >
                                      <RefreshCw size={14} /> View Local Data
                                    </button>
                                    <button
                                      className="episode-dropdown-item"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&season=${ep.season_number}&episode=${ep.episode_number}&mediaId=${showDetails.localId || ''}`);
                                      }}
                                    >
                                      <History size={14} /> View Watch History
                                    </button>
                                  </div>

                                  {/* Mobile Bottom Sheet Menu */}
                                  <MobileBottomSheet title="Episode Options" onClose={() => setActiveEpisodeMenu(null)}>
                                    {showDetails.external_ids?.imdb_id && (
                                      <a
                                        href={`https://www.imdb.com/title/${showDetails.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mobile-sheet-option"
                                        onClick={() => setActiveEpisodeMenu(null)}
                                      >
                                        <ExternalLink size={16} /> View on IMDb
                                      </a>
                                    )}
                                    <a
                                      href={`https://www.themoviedb.org/tv/${showDetails.id}/season/${ep.season_number}/episode/${ep.episode_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mobile-sheet-option"
                                      onClick={() => setActiveEpisodeMenu(null)}
                                    >
                                      <ExternalLink size={16} /> View on TMDb
                                    </a>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        handleScanEpisode(ep.episode_number);
                                      }}
                                    >
                                      <Search size={16} /> Scan for Media
                                    </button>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        setRawEpisode(ep);
                                        fetchRawData();
                                      }}
                                    >
                                      <RefreshCw size={16} /> View Local Data
                                    </button>
                                    <button
                                      className="mobile-sheet-option"
                                      onClick={() => {
                                        setActiveEpisodeMenu(null);
                                        navigate(`/history?search=${encodeURIComponent(showDetails.name)}&type=tv&season=${ep.season_number}&episode=${ep.episode_number}&mediaId=${showDetails.localId || ''}`);
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
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Danger Zone / Remove Button at the bottom */}
          {
            showDetails.isCollected && (
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
                  <span>Remove Show from Collection</span>
                </button>
              </div>
            )
          }
        </>
      )}

      {/* Show Local Data / Correct Match Modal */}
      {
        showRawModal && (
          <div className="custom-modal-backdrop" onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFiles([]); setSelectedFilesForRematch([]); setModalError(''); setSearchResults([]); }}>
            <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
              <div className="custom-modal-header">
                <h3 style={{ margin: 0, fontWeight: '700' }}>
                  {correctMode ? 'Correct Match' : 'TV Show Local Data & Correction'}
                </h3>
                <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFiles([]); setSelectedFilesForRematch([]); setModalError(''); setSearchResults([]); }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {Object.entries(
                                rawData.files.reduce((acc, file) => {
                                  const parts = file.path.split(/[/\\]/);
                                  parts.pop();
                                  const folder = parts.join('/') || '/';
                                  if (!acc[folder]) acc[folder] = [];
                                  acc[folder].push(file);
                                  return acc;
                                }, {})
                              ).map(([folder, filesInFolder]) => (
                                <div key={folder} className="glass-panel" style={{ padding: '12px', background: 'var(--overlay-subtle)', borderRadius: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', wordBreak: 'break-all', fontSize: '0.9rem' }}>
                                      {folder}
                                    </div>
                                    <button
                                      onClick={() => startFileReMatch(filesInFolder)}
                                      className="btn btn-primary"
                                      style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                                    >
                                      Re-match Folder
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {filesInFolder.map(f => (
                                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '6px', background: 'var(--bg-input)', borderRadius: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                          <input 
                                            type="checkbox" 
                                            id={`file-check-${f.id}`} 
                                            checked={selectedFilesForRematch.includes(f.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedFilesForRematch(prev => [...prev, f.id]);
                                              } else {
                                                setSelectedFilesForRematch(prev => prev.filter(id => id !== f.id));
                                              }
                                            }}
                                          />
                                          <label htmlFor={`file-check-${f.id}`} style={{ color: 'var(--text-muted)', wordBreak: 'break-all', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.path.split(/[/\\]/).pop()}>
                                            {f.season !== null && `S${String(f.season).padStart(2, '0')}E${String(f.episode).padStart(2, '0')} - `}{f.path.split(/[/\\]/).pop()}
                                          </label>
                                        </div>
                                        <button
                                          onClick={() => startFileReMatch([f])}
                                          className="btn btn-secondary"
                                          style={{ padding: '2px 8px', fontSize: '0.8rem', flexShrink: 0 }}
                                        >
                                          Re-match
                                        </button>
                                      </div>
                                    ))}
                                    {filesInFolder.some(f => selectedFilesForRematch.includes(f.id)) && (
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                        <button
                                          onClick={() => {
                                            const selectedIds = filesInFolder.map(f => f.id).filter(id => selectedFilesForRematch.includes(id));
                                            const filesToRematch = filesInFolder.filter(f => selectedIds.includes(f.id));
                                            startFileReMatch(filesToRematch);
                                          }}
                                          className="btn btn-secondary"
                                          style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                                        >
                                          Re-match Selected
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--overlay-subtle)', borderRadius: '6px' }}>
                              No local files detected for this show in the database.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {correctingFiles.length > 0 && (
                          <div style={{
                            background: 'var(--overlay-subtle)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '10px 14px',
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Correcting {correctingFiles.length} File(s):</div>
                            <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {correctingFiles.map(f => (
                                <code key={f.id} style={{ color: 'var(--text-main)', wordBreak: 'break-all', display: 'block' }}>{f.path}</code>
                              ))}
                            </div>
                          </div>
                        )}

                        {correctingFiles.length === 0 && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Search TMDB for the correct TV show, or enter a target TMDB ID or IMDb ID (ttXXXXXXX) directly below.
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
                                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1rem' }}>
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
                        setCorrectingFiles([]);
                        setCorrectTitle(showDetails?.name || '');
                        const airYear = showDetails?.first_air_date ? showDetails.first_air_date.substring(0, 4) : '';
                        setCorrectYear(airYear);
                        setCorrectId('');
                        setSearchResults([]);
                        setModalError('');
                        setCorrectMode(true);
                      }}
                    >
                      Correct Match
                    </button>
                    <button className="btn btn-primary" onClick={() => { setShowRawModal(false); setCorrectMode(false); setCorrectingFiles([]); setModalError(''); setSearchResults([]); }}>
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => { setCorrectMode(false); setCorrectingFiles([]); setModalError(''); setSearchResults([]); }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Season Raw Info Modal */}
      {
        showSeasonRawModal && (
          <div className="custom-modal-backdrop" onClick={() => { setShowSeasonRawModal(false); setModalError(''); }}>
            <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
              <div className="custom-modal-header">
                <h3 style={{ margin: 0, fontWeight: '700' }}>Season {activeSeason} Local Data</h3>
                <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setShowSeasonRawModal(false); setModalError(''); }}>
                  <X size={20} />
                </button>
              </div>

              <div className="custom-modal-body">
                {loadingRaw ? (
                  <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                    <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching database records...</span>
                  </div>
                ) : modalError ? (
                  <div style={{ color: 'var(--danger)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                    {modalError}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Season {activeSeason} Local File Paths</h4>
                      {rawData?.files && rawData.files.filter(f => f.season === activeSeason).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {rawData.files.filter(f => f.season === activeSeason).map(f => (
                            <div key={f.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--overlay-subtle)' }}>
                              <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>
                                S{String(f.season).padStart(2, '0')}E{String(f.episode).padStart(2, '0')} - {f.path}
                              </code>
                              <button
                                onClick={() => startFileReMatch(f)}
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
                          No local files detected for Season {activeSeason} in the database.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="custom-modal-footer">
                <button className="btn btn-primary" onClick={() => setShowSeasonRawModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Episode Local Data Modal */}
      {
        rawEpisode && (
          <div className="custom-modal-backdrop" onClick={() => { setRawEpisode(null); setModalError(''); }}>
            <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
              <div className="custom-modal-header">
                <h3 style={{ margin: 0, fontWeight: '700' }}>
                  S{String(rawEpisode.season_number).padStart(2, '0')}E{String(rawEpisode.episode_number).padStart(2, '0')} Local Data
                </h3>
                <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={() => { setRawEpisode(null); setModalError(''); }}>
                  <X size={20} />
                </button>
              </div>

              <div className="custom-modal-body">
                {loadingRaw ? (
                  <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                    <RefreshCw className="spin" size={24} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching database records...</span>
                  </div>
                ) : modalError ? (
                  <div style={{ color: 'var(--danger)', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                    {modalError}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Local File Paths</h4>
                      {rawData?.files && rawData.files.filter(f => f.season === rawEpisode.season_number && f.episode === rawEpisode.episode_number).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {rawData.files.filter(f => f.season === rawEpisode.season_number && f.episode === rawEpisode.episode_number).map(f => (
                            <div key={f.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--overlay-subtle)' }}>
                              <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1, fontSize: '0.85rem' }}>
                                {f.path}
                              </code>
                              <button
                                onClick={() => startFileReMatch(f)}
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
                          No local files detected for this episode in the database.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="custom-modal-footer">
                <button className="btn btn-primary" onClick={() => setRawEpisode(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

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
        .episode-card {
          border: 1px solid transparent;
          transition: background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease;
        }
        .episode-card-highlighted {
          border-color: var(--accent) !important;
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.3) !important;
          background: rgba(124, 58, 237, 0.08) !important;
        }
      `}</style>

      {
        showDetails && (
          <ImageSelectorModal
            isOpen={imageSelectorOpen}
            onClose={() => setImageSelectorOpen(false)}
            mediaType="tv"
            tmdbId={showDetails.id}
            imageType={imageSelectorType}
            currentPath={imageSelectorType === 'poster' ? showDetails.poster_path : showDetails.backdrop_path}
            onSelect={handleImageSelected}
          />
        )
      }

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

      {isWatchOptionsOpen && (
        <WatchOptionsModal
          isOpen={isWatchOptionsOpen}
          onClose={() => setIsWatchOptionsOpen(false)}
          media={watchOptionsMedia}
          onSelect={handleWatchOptionsSelect}
          onWatchStatusChange={(newIsWatched) => {
            if (!activeWatchEpisode) return;
            setSeasonEpisodes(prev => prev.map(ep =>
              ep.id === activeWatchEpisode.id ? { ...ep, isWatched: newIsWatched } : ep
            ));
            setShowDetails(prev => {
              let updatedWatched = [...prev.watchedEpisodes];
              if (!newIsWatched) {
                updatedWatched = updatedWatched.filter(x => !(x.season === activeWatchEpisode.season_number && x.episode === activeWatchEpisode.episode_number));
              } else {
                const exists = updatedWatched.some(x => x.season === activeWatchEpisode.season_number && x.episode === activeWatchEpisode.episode_number);
                if (!exists) {
                  updatedWatched.push({ season: activeWatchEpisode.season_number, episode: activeWatchEpisode.episode_number });
                }
              }
              return {
                ...prev,
                watchedEpisodes: updatedWatched
              };
            });
          }}
        />
      )}
    </div >
  );
};

export default ShowDetails;

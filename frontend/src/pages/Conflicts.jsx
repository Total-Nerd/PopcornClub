import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { AlertTriangle, RefreshCw, Trash2, Film, Tv, ExternalLink, X, Search, Check } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const Conflicts = () => {
  const { showAlert, showConfirm } = useModal();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'title_mismatch', 'year_mismatch', 'missing_metadata', 'no_files', 'missing_episode'
  const [showIgnoredEpisodes, setShowIgnoredEpisodes] = useState(false);

  // Correction Modal States
  const [correctionTarget, setCorrectionTarget] = useState(null); // conflict item being corrected
  const [correctingFilePath, setCorrectingFilePath] = useState(null); // specific file path targeted
  const [correctTitle, setCorrectTitle] = useState('');
  const [correctYear, setCorrectYear] = useState('');
  const [correctId, setCorrectId] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Missing Episodes Group Modal State
  const [missingGroupTarget, setMissingGroupTarget] = useState(null);
  const [expandedSeasons, setExpandedSeasons] = useState({});

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

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media/conflicts');
      setConflicts(res.data);
    } catch (err) {
      console.error('Failed to fetch media conflicts:', err);
      showAlert('Failed to fetch media conflicts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleForceRemove = async (item) => {
    const confirmed = await showConfirm(`Are you sure you want to permanently remove "${item.title}" and all its logs from your database? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.post('/media/force-remove', {
        tmdbId: item.tmdbId,
        type: item.type
      });
      showAlert('Media item removed successfully.', 'success');
      fetchConflicts();
    } catch (err) {
      console.error('Failed to remove media:', err);
      showAlert('Failed to remove media: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleIgnoreEpisode = async (item) => {
    try {
      await api.post('/media/missing-episodes/ignore', {
        mediaId: item.mediaId,
        season: item.season,
        episode: item.episode
      });
      fetchConflicts();
    } catch (err) {
      showAlert('Failed to ignore episode.', 'error');
    }
  };

  const handleUnignoreEpisode = async (item) => {
    try {
      await api.post('/media/missing-episodes/unignore', {
        mediaId: item.mediaId,
        season: item.season,
        episode: item.episode
      });
      fetchConflicts();
    } catch (err) {
      showAlert('Failed to unignore episode.', 'error');
    }
  };

  const handleScanEpisode = async (item) => {
    try {
      showAlert(`Scanning for ${item.title} S${item.season}E${item.episode}...`, 'info');
      await api.post(`/media/scan/tv/${item.tmdbId}?season=${item.season}&episode=${item.episode}`);
      showAlert('Scan completed.', 'success');
      fetchConflicts();
    } catch (err) {
      showAlert('Scan failed.', 'error');
    }
  };

  const handleIgnoreGroup = async (group) => {
    try {
      await Promise.all(group.episodes.map(ep => 
        api.post('/media/missing-episodes/ignore', {
          mediaId: ep.mediaId,
          season: ep.season,
          episode: ep.episode
        }).catch(e => console.error(e))
      ));
      fetchConflicts();
      if (missingGroupTarget?.mediaId === group.mediaId) closeMissingGroupModal();
    } catch (err) {
      showAlert('Failed to ignore some episodes.', 'error');
    }
  };

  const handleUnignoreGroup = async (group) => {
    try {
      await Promise.all(group.episodes.map(ep => 
        api.post('/media/missing-episodes/unignore', {
          mediaId: ep.mediaId,
          season: ep.season,
          episode: ep.episode
        }).catch(e => console.error(e))
      ));
      fetchConflicts();
      if (missingGroupTarget?.mediaId === group.mediaId) closeMissingGroupModal();
    } catch (err) {
      showAlert('Failed to unignore some episodes.', 'error');
    }
  };

  const handleIgnoreSeason = async (episodes) => {
    try {
      await Promise.all(episodes.map(ep => 
        api.post('/media/missing-episodes/ignore', {
          mediaId: ep.mediaId,
          season: ep.season,
          episode: ep.episode
        }).catch(e => console.error(e))
      ));
      fetchConflicts();
      setMissingGroupTarget(prev => ({
        ...prev,
        episodes: prev.episodes.filter(e => !episodes.some(ignored => ignored.id === e.id))
      }));
    } catch (err) {
      showAlert('Failed to ignore season episodes.', 'error');
    }
  };

  const handleUnignoreSeason = async (episodes) => {
    try {
      await Promise.all(episodes.map(ep => 
        api.post('/media/missing-episodes/unignore', {
          mediaId: ep.mediaId,
          season: ep.season,
          episode: ep.episode
        }).catch(e => console.error(e))
      ));
      fetchConflicts();
      setMissingGroupTarget(prev => ({
        ...prev,
        episodes: prev.episodes.filter(e => !episodes.some(unignored => unignored.id === e.id))
      }));
    } catch (err) {
      showAlert('Failed to unignore season episodes.', 'error');
    }
  };

  const handleScanGroup = async (group) => {
    try {
      showAlert(`Scanning for ${group.title}...`, 'info');
      await api.post(`/media/scan/tv/${group.tmdbId}`);
      showAlert('Scan completed.', 'success');
      fetchConflicts();
    } catch (err) {
      showAlert('Scan failed.', 'error');
    }
  };

  const openCorrectionModal = (item, filePath = null) => {
    setCorrectionTarget(item);
    setCorrectingFilePath(filePath);
    if (filePath) {
      const parsed = parseFilenameFromPath(filePath);
      setCorrectTitle(parsed.title);
      setCorrectYear(item.conflictType === 'year_mismatch' ? '' : parsed.year);
    } else {
      setCorrectTitle(item.title);
      const itemYear = item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '';
      setCorrectYear(item.conflictType === 'year_mismatch' ? '' : itemYear);
    }
    setCorrectId('');
    setSearchResults([]);
    setModalError('');
  };

  const closeCorrectionModal = () => {
    setCorrectionTarget(null);
    setCorrectingFilePath(null);
  };

  const openMissingGroupModal = (group, isIgnored = false) => {
    setMissingGroupTarget({ ...group, isIgnored });
    setExpandedSeasons({});
  };
  const closeMissingGroupModal = () => setMissingGroupTarget(null);

  const toggleSeason = (seasonNum) => {
    setExpandedSeasons(prev => ({ ...prev, [seasonNum]: !prev[seasonNum] }));
  };

  const handleSearchCorrection = async () => {
    if (!correctTitle) return;
    setSearching(true);
    setModalError('');
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(correctTitle)}`);
      let results = res.data.filter(item => item.media_type === correctionTarget.type);
      if (correctYear) {
        results = results.filter(item => {
          const itemYear = (item.release_date || item.first_air_date || '').substring(0, 4);
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
        type: correctionTarget.type
      };
      
      if (correctingFilePath) {
        payload.filePath = correctingFilePath;
      } else {
        payload.oldTmdbId = correctionTarget.mediaId;
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

      const endpoint = correctingFilePath ? '/media/correct-file' : '/media/correct';
      await api.post(endpoint, payload);
      showAlert('Correction applied successfully!', 'success');
      closeCorrectionModal();
      fetchConflicts();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to apply correction.');
    } finally {
      setCorrecting(false);
    }
  };

  const getConflictBadgeName = (type) => {
    switch (type) {
      case 'title_mismatch': return 'Title Mismatch';
      case 'year_mismatch': return 'Year Mismatch';
      case 'missing_metadata': return 'Missing Metadata';
      case 'no_files': return 'Orphaned Record';
      default: return 'Conflict';
    }
  };

  const getConflictBadgeStyle = (type) => {
    switch (type) {
      case 'title_mismatch': return { background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' };
      case 'year_mismatch': return { background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' };
      case 'missing_metadata': return { background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' };
      case 'no_files': return { background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)' };
      default: return {};
    }
  };

  let filteredConflicts = activeTab === 'all' 
    ? conflicts.filter(c => c.conflictType !== 'missing-episode') 
    : conflicts.filter(c => c.conflictType === activeTab);

  const getCounts = (type) => conflicts.filter(c => c.conflictType === type && !c.ignored).length;
  const missingEpisodes = conflicts.filter(c => c.conflictType === 'missing-episode' && !c.ignored);
  const ignoredEpisodes = conflicts.filter(c => c.conflictType === 'missing-episode' && c.ignored);

  const groupedMissing = Object.values(missingEpisodes.reduce((acc, curr) => {
    if (!acc[curr.mediaId]) {
      acc[curr.mediaId] = {
        conflictType: 'missing-episode-group',
        mediaId: curr.mediaId,
        tmdbId: curr.tmdbId,
        title: curr.title,
        posterPath: curr.posterPath,
        type: 'tv',
        episodes: []
      };
    }
    acc[curr.mediaId].episodes.push(curr);
    return acc;
  }, {})).sort((a, b) => b.episodes.length - a.episodes.length);

  const groupedIgnored = Object.values(ignoredEpisodes.reduce((acc, curr) => {
    if (!acc[curr.mediaId]) {
      acc[curr.mediaId] = {
        conflictType: 'missing-episode-group',
        mediaId: curr.mediaId,
        tmdbId: curr.tmdbId,
        title: curr.title,
        posterPath: curr.posterPath,
        type: 'tv',
        episodes: []
      };
    }
    acc[curr.mediaId].episodes.push(curr);
    return acc;
  }, {})).sort((a, b) => b.episodes.length - a.episodes.length);

  if (activeTab === 'missing-episode') {
    filteredConflicts = groupedMissing;
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <AlertTriangle size={32} style={{ color: 'var(--accent)' }} />
        <h1>Conflicts & Errors</h1>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.6', maxWidth: '800px' }}>
        This page scans your media files on disk and compares their parsed filenames with TMDB metadata. Mismatched years, title overrides, orphaned DB records, and blank entries are flagged here so you can re-match or remove them.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => setActiveTab('all')} className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}>
          All ({conflicts.filter(c => c.conflictType !== 'missing-episode').length})
        </button>
        <button onClick={() => setActiveTab('title_mismatch')} className={`filter-btn ${activeTab === 'title_mismatch' ? 'active' : ''}`}>
          Title Mismatches ({getCounts('title_mismatch')})
        </button>
        <button onClick={() => setActiveTab('year_mismatch')} className={`filter-btn ${activeTab === 'year_mismatch' ? 'active' : ''}`}>
          Year Mismatches ({getCounts('year_mismatch')})
        </button>
        <button onClick={() => setActiveTab('missing_metadata')} className={`filter-btn ${activeTab === 'missing_metadata' ? 'active' : ''}`}>
          Missing Details ({getCounts('missing_metadata')})
        </button>
        <button onClick={() => setActiveTab('no_files')} className={`filter-btn ${activeTab === 'no_files' ? 'active' : ''}`}>
          Orphaned Records ({getCounts('no_files')})
        </button>
        <button onClick={() => setActiveTab('missing-episode')} className={`filter-btn ${activeTab === 'missing-episode' ? 'active' : ''}`}>
          Missing Episodes ({missingEpisodes.length})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeft: '4px solid var(--accent)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : filteredConflicts.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Check size={48} style={{ color: 'var(--success)', opacity: 0.8, marginBottom: '16px' }} />
          <h3>No Conflicts Detected</h3>
          <p style={{ marginTop: '8px' }}>Your media library looks clean and correctly matched!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredConflicts.map((item, idx) => {
            const isMovie = item.type === 'movie';
            const detailsUrl = isMovie ? `/movies/${item.tmdbId}` : `/shows/${item.tmdbId}`;

            return (
              <div key={idx} className="glass-panel" style={{ display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Poster */}
                <div style={{ width: '80px', height: '120px', borderRadius: '6px', overflow: 'hidden', background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      {isMovie ? <Film size={32} /> : <Tv size={32} />}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <Link to={detailsUrl} className="hover-underline" style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {item.title}
                    </Link>
                    <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--overlay-medium)', color: 'var(--text-muted)' }}>
                      {isMovie ? 'Movie' : 'TV Show'}
                    </span>
                    {item.conflictType !== 'missing-episode-group' && (
                      <span className="badge" style={{ fontSize: '0.75rem', padding: '2px 8px', ...getConflictBadgeStyle(item.conflictType) }}>
                        {getConflictBadgeName(item.conflictType)}
                      </span>
                    )}
                  </div>

                  {item.conflictType === 'missing-episode-group' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: 0 }}>
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>{item.episodes.length}</span> missing episodes.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => openMissingGroupModal(item, false)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'fit-content' }}
                        >
                          View Missing Episodes
                        </button>
                        <button 
                          onClick={() => handleIgnoreGroup(item)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'fit-content' }}
                        >
                          Ignore All
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '500', marginBottom: '12px' }}>
                      {item.message}
                    </p>
                  )}

                  {/* Associated Local Files */}
                  {item.files?.length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', marginTop: '12px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Linked Local Files:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {item.files.map((file, fIdx) => (
                          <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <code style={{ color: 'var(--text-main)', wordBreak: 'break-all', flex: 1 }}>{file}</code>
                            <button
                              onClick={() => openCorrectionModal(item, file)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '0.75rem', flexShrink: 0 }}
                            >
                              Re-match Path
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '160px', flexShrink: 0 }}>
                  {item.conflictType !== 'no_files' && item.conflictType !== 'missing-episode-group' && (
                    <button
                      onClick={() => openCorrectionModal(item)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} /> Re-match All
                    </button>
                  )}
                  {item.conflictType !== 'missing-episode-group' && (
                    <button
                      onClick={() => handleForceRemove(item)}
                      className="btn"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.25)'
                      }}
                    >
                      <Trash2 size={14} /> Force Remove
                    </button>
                  )}
                  {item.conflictType === 'missing-episode-group' && (
                    <>
                      <button
                        onClick={() => handleScanGroup(item)}
                        className="btn btn-primary"
                        style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Search size={14} /> Scan Show
                      </button>
                      <button
                        onClick={() => handleIgnoreGroup(item)}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <X size={14} /> Ignore All
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ignored Episodes Section */}
      {!loading && activeTab === 'missing-episode' && ignoredEpisodes.length > 0 && (
        <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setShowIgnoredEpisodes(!showIgnoredEpisodes)}
            className="btn btn-secondary"
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}
          >
            <span>Ignored Episodes ({ignoredEpisodes.length})</span>
            <span>{showIgnoredEpisodes ? 'Hide' : 'Show'}</span>
          </button>
          
          {showIgnoredEpisodes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {groupedIgnored.map((item, idx) => (
                <div key={idx} className="glass-panel" style={{ display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Poster */}
                  <div style={{ width: '80px', height: '120px', borderRadius: '6px', overflow: 'hidden', background: 'var(--overlay-subtle)', border: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>
                        <Tv size={32} />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <Link to={`/shows/${item.tmdbId}`} className="hover-underline" style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {item.title}
                      </Link>
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--overlay-medium)', color: 'var(--text-muted)' }}>
                        TV Show
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: 0 }}>
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>{item.episodes.length}</span> ignored episodes.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => openMissingGroupModal(item, true)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'fit-content' }}
                        >
                          View Ignored Episodes
                        </button>
                        <button 
                          onClick={() => handleUnignoreGroup(item)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'fit-content' }}
                        >
                          Unignore All
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Correction Dialog Modal */}
      {correctionTarget && (
        <div className="custom-modal-backdrop" onClick={closeCorrectionModal}>
          <div className="custom-modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontWeight: '700' }}>Correct Match</h3>
              <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={closeCorrectionModal}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body">
              {modalError && (
                <div style={{ color: 'var(--danger)', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.88rem' }}>
                  {modalError}
                </div>
              )}

              {correctingFilePath && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Correcting File Path:</div>
                  <code style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{correctingFilePath}</code>
                </div>
              )}

              {/* Search fields */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
                <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => submitCorrection(result.id)}
                      style={{ display: 'flex', gap: '12px', padding: '8px', borderRadius: '6px', background: 'var(--overlay-subtle)', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                      className="hover-bg"
                    >
                      <div style={{ width: '40px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {(result.release_date || result.first_air_date || '').substring(0, 4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual ID Input */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
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

            <div className="custom-modal-footer">
              <button className="btn btn-secondary" onClick={closeCorrectionModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Group Modal */}
      {missingGroupTarget && (
        <div className="custom-modal-backdrop" onClick={closeMissingGroupModal}>
          <div className="custom-modal-content" style={{ width: '90%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontWeight: '700' }}>{missingGroupTarget.isIgnored ? 'Ignored Episodes' : 'Missing Episodes'} - {missingGroupTarget.title}</h3>
              <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={closeMissingGroupModal}>
                <X size={20} />
              </button>
            </div>

            <div className="custom-modal-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              <div style={{ padding: '20px', display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                <div style={{ width: '100px', height: '150px', borderRadius: '8px', overflow: 'hidden', background: 'var(--overlay-subtle)', flexShrink: 0 }}>
                  {missingGroupTarget.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w154${missingGroupTarget.posterPath}`} alt={missingGroupTarget.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Tv size={32} /></div>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>{missingGroupTarget.title}</h2>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleScanGroup(missingGroupTarget)} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                      <RefreshCw size={16} /> Scan Show
                    </button>
                    {missingGroupTarget.isIgnored ? (
                      <button onClick={() => handleUnignoreGroup(missingGroupTarget)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                        <RefreshCw size={16} /> Unignore All
                      </button>
                    ) : (
                      <button onClick={() => handleIgnoreGroup(missingGroupTarget)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                        <Trash2 size={16} /> Ignore All
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                {(() => {
                  const activeEpisodes = missingGroupTarget.isIgnored 
                    ? missingGroupTarget.episodes.filter(ep => ep.ignored) 
                    : missingGroupTarget.episodes.filter(ep => !ep.ignored);
                  
                  if (activeEpisodes.length === 0 && !missingGroupTarget.isIgnored) {
                    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>All missing episodes have been ignored.</div>;
                  }

                  // Group by season
                  const bySeason = {};
                  activeEpisodes.forEach(ep => {
                    if (!bySeason[ep.season]) bySeason[ep.season] = [];
                    bySeason[ep.season].push(ep);
                  });

                  return Object.keys(bySeason).sort((a,b) => Number(a) - Number(b)).map(season => {
                    const eps = bySeason[season];
                    const isExpanded = expandedSeasons[season];
                    return (
                      <div key={season} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--overlay-subtle)' }}>
                        <button 
                          onClick={() => toggleSeason(season)}
                          style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '600', fontSize: '1.05rem', transition: 'background 0.2s' }}
                          className="hover-bg"
                        >
                          <span>Season {season}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{eps.length} missing episode{eps.length > 1 ? 's' : ''}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); missingGroupTarget.isIgnored ? handleUnignoreSeason(eps) : handleIgnoreSeason(eps); }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            >
                              {missingGroupTarget.isIgnored ? 'Unignore Season' : 'Ignore Season'}
                            </button>
                          </div>
                        </button>

                        {isExpanded && (
                          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {eps.map(ep => (
                              <div key={ep.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--overlay-medium)', borderRadius: '6px', border: '1px solid var(--border-color)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                {/* Episode Image */}
                                <div style={{ width: '160px', aspectRatio: '16/9', borderRadius: '4px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                                  {ep.epStillPath ? (
                                    <img src={`https://image.tmdb.org/t/p/w300${ep.epStillPath}`} alt={ep.epName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Tv size={24}/></div>
                                  )}
                                </div>
                                
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                                    {ep.episode}. {ep.epName || `Episode ${ep.episode}`}
                                  </div>
                                  {ep.epOverview && (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '8px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      {ep.epOverview}
                                    </p>
                                  )}
                                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '0.8rem' }}>
                                    <a href={`https://www.themoviedb.org/tv/${ep.tmdbId}/season/${ep.season}/episode/${ep.episode}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <ExternalLink size={12}/> TMDB
                                    </a>
                                    <a href={`https://www.imdb.com/find/?q=${encodeURIComponent(ep.title)}`} target="_blank" rel="noreferrer" style={{ color: '#f5c518', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <ExternalLink size={12}/> IMDB Search
                                    </a>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
                                  <button onClick={() => handleScanEpisode(ep)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', width: '100%' }}>
                                    Scan
                                  </button>
                                  <button 
                                    onClick={() => { 
                                      if (missingGroupTarget.isIgnored) {
                                        handleUnignoreEpisode(ep);
                                      } else {
                                        handleIgnoreEpisode(ep); 
                                      }
                                      setMissingGroupTarget(prev => ({...prev, episodes: prev.episodes.filter(e => e.id !== ep.id)}));
                                    }} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', width: '100%' }}
                                  >
                                    {missingGroupTarget.isIgnored ? 'Unignore' : 'Ignore'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="custom-modal-footer">
              <button className="btn btn-secondary" onClick={closeMissingGroupModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-underline:hover {
          text-decoration: underline;
        }
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
    </div>
  );
};

export default Conflicts;

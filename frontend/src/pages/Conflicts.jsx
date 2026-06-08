import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { AlertTriangle, RefreshCw, Trash2, Film, Tv, ExternalLink, X, Search, Check } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const Conflicts = () => {
  const { showAlert, showConfirm } = useModal();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'title_mismatch', 'year_mismatch', 'missing_metadata', 'no_files'

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

  const filteredConflicts = activeTab === 'all' 
    ? conflicts 
    : conflicts.filter(c => c.conflictType === activeTab);

  const getCounts = (type) => conflicts.filter(c => c.conflictType === type).length;

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
          All ({conflicts.length})
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
                    <span className="badge" style={{ fontSize: '0.75rem', padding: '2px 8px', ...getConflictBadgeStyle(item.conflictType) }}>
                      {getConflictBadgeName(item.conflictType)}
                    </span>
                  </div>

                  <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '500', marginBottom: '12px' }}>
                    {item.message}
                  </p>

                  {/* Associated Local Files */}
                  {item.files.length > 0 && (
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
                  {item.conflictType !== 'no_files' && (
                    <button
                      onClick={() => openCorrectionModal(item)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} /> Re-match All
                    </button>
                  )}
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
                </div>
              </div>
            );
          })}
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

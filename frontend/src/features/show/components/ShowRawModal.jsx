import React, { useState } from 'react';
import { useShowStore } from '../store/useShowStore';
import { RefreshCw, X, Search } from 'lucide-react';
import api from '../../../api';
import { useModal } from '../../../context/ModalContext';
import { useNavigate } from 'react-router-dom';

const ShowRawModal = ({ tmdbId }) => {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const {
    showRawModal, setShowRawModal,
    correctMode, setCorrectMode,
    correctingFiles, setCorrectingFiles,
    correctTitle, setCorrectTitle,
    correctYear, setCorrectYear,
    correctId, setCorrectId,
    modalError, setModalError,
    correcting, setCorrecting,
    rawData, fetchRawData,
    showDetails
  } = useShowStore();

  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFilesForRematch, setSelectedFilesForRematch] = useState([]);

  if (!showRawModal) return null;

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
        fetchRawData(tmdbId);
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
    let tmdbIdMatch = '';
    if (tmdbMatch) {
      tmdbIdMatch = tmdbMatch[1];
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

    return { title: cleanTitleStr, year, tmdbId: tmdbIdMatch };
  };

  const startFileReMatch = (files) => {
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

  const closeModal = () => {
    setShowRawModal(false);
    setCorrectMode(false);
    setCorrectingFiles([]);
    setSelectedFilesForRematch([]);
  };

  return (
    <div className="custom-modal-backdrop" onClick={closeModal}>
      <div className="custom-modal-content" style={{ maxWidth: '800px', width: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="custom-modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={20} />
            {correctMode 
              ? (correctingFiles.length > 0 ? `Correcting ${correctingFiles.length} file(s)` : 'Correcting Match') 
              : 'Local Data'}
          </h3>
          <button className="btn" style={{ padding: '4px', background: 'transparent' }} onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        <div className="custom-modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
          {modalError && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {modalError}
            </div>
          )}

          {correctMode ? (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                {correctingFiles.length > 0 
                  ? 'Search for the correct TV show to re-match these specific files. Once corrected, these files will be moved to the new show.' 
                  : 'Search for the correct TV show to re-match this entire library item.'}
              </p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Show Title"
                  className="search-input"
                  value={correctTitle}
                  onChange={(e) => setCorrectTitle(e.target.value)}
                  style={{ flex: '1', minWidth: '200px' }}
                  onKeyDown={e => e.key === 'Enter' && handleSearchCorrection()}
                />
                <input
                  type="text"
                  placeholder="Year (Opt)"
                  className="search-input"
                  value={correctYear}
                  onChange={(e) => setCorrectYear(e.target.value)}
                  style={{ width: '100px' }}
                  onKeyDown={e => e.key === 'Enter' && handleSearchCorrection()}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleSearchCorrection}
                  disabled={searching || !correctTitle}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Search size={16} /> {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Search Results:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                    {searchResults.map(res => (
                      <div 
                        key={res.id}
                        className="glass-panel"
                        style={{ padding: '8px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', border: '1px solid var(--border-color)' }}
                        onClick={() => submitCorrection(res.id, null)}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {res.poster_path ? (
                          <img src={`https://image.tmdb.org/t/p/w200${res.poster_path}`} alt={res.name} style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: '2/3', background: '#1e293b', borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Cover</div>
                        )}
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', lineHeight: '1.2', marginBottom: '4px' }}>{res.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{res.first_air_date ? res.first_air_date.substring(0, 4) : 'Unknown'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>OR EXACT MATCH</div>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="TMDB ID or IMDb ID (tt...)"
                  className="search-input"
                  value={correctId}
                  onChange={(e) => setCorrectId(e.target.value)}
                  style={{ flex: '1' }}
                />
                <button 
                  className="btn btn-secondary" 
                  onClick={() => submitCorrection()}
                  disabled={correcting || !correctId}
                >
                  {correcting ? 'Applying...' : 'Apply ID'}
                </button>
              </div>

              <div style={{ marginTop: '24px', textAlign: 'right' }}>
                <button className="btn btn-secondary" onClick={() => {
                  setCorrectMode(false);
                  setSearchResults([]);
                  setCorrectingFiles([]);
                  setSelectedFilesForRematch([]);
                }}>Back to Local Data</button>
              </div>
            </div>
          ) : (
            <div>
              {!rawData ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading raw data...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>Found {rawData.media?.files?.length || 0} local files</h4>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {selectedFilesForRematch.length > 0 && (
                        <button 
                          className="btn btn-primary" 
                          onClick={() => startFileReMatch(selectedFilesForRematch.map(id => rawData.media.files.find(f => f.id === id)))}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          <RefreshCw size={14} /> Re-match selected ({selectedFilesForRematch.length})
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setCorrectingFiles([]);
                          setSelectedFilesForRematch([]);
                          setCorrectTitle(showDetails?.name || '');
                          const yr = showDetails?.first_air_date ? showDetails.first_air_date.substring(0,4) : '';
                          setCorrectYear(yr);
                          setCorrectId('');
                          setCorrectMode(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        <RefreshCw size={14} /> Fix Match for Entire Show
                      </button>
                    </div>
                  </div>
                  
                  {rawData.media?.files && rawData.media.files.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {rawData.media.files.map(file => {
                        const isSelected = selectedFilesForRematch.includes(file.id);
                        return (
                          <div 
                            key={file.id} 
                            style={{ 
                              padding: '12px', 
                              background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--overlay-subtle)', 
                              border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)', 
                              borderRadius: '8px', 
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.1s'
                            }}
                            onClick={() => {
                              setSelectedFilesForRematch(prev => 
                                prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id]
                              );
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => {}}
                              style={{ marginTop: '4px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--text-main)', marginBottom: '8px' }}>{file.path}</div>
                              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
                                <span>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                {file.resolution && <span>Res: {file.resolution}</span>}
                                {file.videoCodec && <span>Codec: {file.videoCodec}</span>}
                                {file.audioCodec && <span>Audio: {file.audioCodec}</span>}
                              </div>
                            </div>
                            <button 
                              className="btn btn-secondary" 
                              onClick={(e) => {
                                e.stopPropagation();
                                startFileReMatch([file]);
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <RefreshCw size={12} /> Re-match
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--overlay)', borderRadius: '8px' }}>
                      No local files currently mapped to this show in the database.
                    </div>
                  )}
                  
                  <div style={{ marginTop: '24px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Raw DB Record</h4>
                    <pre style={{ background: '#000', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '0.8rem', color: '#a3e635', margin: 0, border: '1px solid #1f2937' }}>
                      {JSON.stringify(rawData.media, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowRawModal;

import React from 'react';
import { RefreshCw, X, Search, Check, Edit } from 'lucide-react';
import { useMovieStore } from '../store/useMovieStore';

const MovieRawModal = ({ tmdbId, parseFilenameFromPath, submitCorrection }) => {
  const {
    showRawModal, setShowRawModal,
    rawData, loadingRaw,
    correctMode, setCorrectMode,
    correctingFile, setCorrectingFile,
    correctTitle, setCorrectTitle,
    correctYear, setCorrectYear,
    correctId, setCorrectId,
    searchResults, setSearchResults,
    searching, correcting,
    modalError, setModalError,
    movieDetails,
    handleSearchCorrection
  } = useMovieStore();

  if (!showRawModal) return null;

  return (
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
                    <div style={{ color: 'var(--danger)', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', fontSize: '0.9rem' }}>
                      {modalError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Title (for search)</label>
                      <input
                        type="text"
                        className="input-field"
                        value={correctTitle}
                        onChange={e => setCorrectTitle(e.target.value)}
                        placeholder="e.g. Inception"
                        onKeyDown={e => e.key === 'Enter' && handleSearchCorrection()}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Year</label>
                      <input
                        type="text"
                        className="input-field"
                        value={correctYear}
                        onChange={e => setCorrectYear(e.target.value)}
                        placeholder="e.g. 2010"
                        onKeyDown={e => e.key === 'Enter' && handleSearchCorrection()}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '10px' }}
                      onClick={handleSearchCorrection}
                      disabled={searching || !correctTitle}
                    >
                      {searching ? <RefreshCw className="spin" size={16} /> : <Search size={16} />}
                      <span>{searching ? 'Searching...' : 'Search TMDB'}</span>
                    </button>
                  </div>

                  <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Direct TMDB ID or IMDb ID</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ flex: 1 }}
                        value={correctId}
                        onChange={e => setCorrectId(e.target.value)}
                        placeholder="e.g. 27205 or tt1375666"
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => submitCorrection(null, null)}
                        disabled={correcting || !correctId}
                      >
                        {correcting && correctId ? <RefreshCw className="spin" size={16} /> : <Check size={16} />}
                        <span>Apply</span>
                      </button>
                    </div>
                  </div>

                  {searchResults.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>Search Results</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                        {searchResults.map(result => {
                          const year = result.release_date ? result.release_date.substring(0, 4) : 'Unknown';
                          return (
                            <div key={result.id} className="glass-panel" style={{ display: 'flex', gap: '12px', padding: '10px', alignItems: 'center', background: 'var(--overlay-subtle)' }}>
                              {result.poster_path ? (
                                <img src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} alt={result.title} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                              ) : (
                                <div style={{ width: '40px', height: '60px', background: '#334155', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>No Img</span>
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{year}</div>
                              </div>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                onClick={() => submitCorrection(result.id, null)}
                                disabled={correcting}
                              >
                                {correcting ? <RefreshCw className="spin" size={14} /> : 'Select'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {searchResults.length === 0 && correctTitle && !searching && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', background: 'var(--overlay-subtle)', borderRadius: '6px' }}>
                      No results found for "{correctTitle}". Try refining the search.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {!loadingRaw && !modalError && !correctMode && (
          <div className="custom-modal-footer">
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              onClick={() => {
                setCorrectingFile(null);
                setCorrectTitle(movieDetails?.title || '');
                setCorrectYear(movieDetails?.release_date ? movieDetails.release_date.substring(0, 4) : '');
                setCorrectId('');
                setSearchResults([]);
                setModalError('');
                setCorrectMode(true);
              }}
            >
              <Search size={18} />
              <span>Correct This Movie (Rematch Entire Record)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieRawModal;

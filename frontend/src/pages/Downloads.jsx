import React, { useState, useEffect, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Download, RefreshCw, AlertCircle, CheckCircle2, Play, Edit2, Trash2, FolderSync, CheckSquare, Square, Layers, Search, Crosshair, ChevronRight, Check } from 'lucide-react';

const Downloads = () => {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [focusedItemId, setFocusedItemId] = useState(null);

  // Edit states for focused item
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Preview states
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Bulk processing states
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    parsedType: 'tv',
    parsedTitle: '',
    parsedYear: '',
    tmdbId: ''
  });
  const [bulkPreviewData, setBulkPreviewData] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // TMDB Search Modal states
  const [tmdbSearchOpen, setTmdbSearchOpen] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbSearchType, setTmdbSearchType] = useState('tv');
  const [tmdbSearchResults, setTmdbSearchResults] = useState([]);
  const [tmdbSearchLoading, setTmdbSearchLoading] = useState(false);
  
  // Target could be: 'bulk', 'single', or an object { type: 'detect', item: ... }
  const [tmdbSearchTarget, setTmdbSearchTarget] = useState(null);

  const fetchItems = async () => {
    try {
      const res = await api.get('/downloads');
      setItems(res.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch pending downloads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchItems();
      const interval = setInterval(fetchItems, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Focus management
  useEffect(() => {
    if (!focusedItemId && items.length > 0) {
      const pendingItems = items.filter(i => i.status === 'pending');
      if (pendingItems.length > 0) {
        setFocusedItemId(pendingItems[0].id);
      }
    } else if (focusedItemId) {
      // check if it still exists
      const exists = items.find(i => i.id === focusedItemId);
      if (!exists) {
        const pendingItems = items.filter(i => i.status === 'pending');
        setFocusedItemId(pendingItems.length > 0 ? pendingItems[0].id : null);
      }
    }
  }, [items, focusedItemId]);

  const focusedItem = items.find(i => i.id === focusedItemId);

  const openTmdbSearch = (target, defaultQuery, defaultType, autoSearch = false) => {
    setTmdbSearchTarget(target);
    setTmdbSearchQuery(defaultQuery || '');
    setTmdbSearchType(defaultType || 'tv');
    setTmdbSearchOpen(true);
    setTmdbSearchResults([]);
    if (autoSearch && defaultQuery) {
      executeTmdbSearch(null, defaultQuery, defaultType);
    }
  };

  const executeTmdbSearch = async (e, overrideQuery, overrideType) => {
    if (e) e.preventDefault();
    const query = overrideQuery || tmdbSearchQuery;
    const type = overrideType || tmdbSearchType;
    
    if (!query) return;
    setTmdbSearchLoading(true);
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(query)}&type=${type}`);
      setTmdbSearchResults(res.data.results || res.data || []);
    } catch (err) {
      setError('TMDB search failed');
    } finally {
      setTmdbSearchLoading(false);
    }
  };

  const handleDetect = async (item) => {
    if (!item.parsedTitle) {
      setError(`Cannot detect without a title for ${item.filename}`);
      return;
    }
    setTmdbSearchLoading(true);
    try {
      const res = await api.get(`/media/search?query=${encodeURIComponent(item.parsedTitle)}&type=${item.parsedType}`);
      const results = res.data.results || res.data || [];
      
      if (results.length === 1) {
        await applyTmdbResult(results[0], item, true);
      } else {
        openTmdbSearch({ type: 'detect', item }, item.parsedTitle, item.parsedType, results.length > 0);
        if (results.length > 0) {
            setTmdbSearchResults(results);
        }
      }
    } catch (err) {
      setError('Detect search failed');
      openTmdbSearch({ type: 'detect', item }, item.parsedTitle, item.parsedType, false);
    } finally {
      setTmdbSearchLoading(false);
    }
  };

  const applyTmdbResult = async (result, sourceItem, autoBatch = false) => {
    const year = result.release_date ? result.release_date.split('-')[0] : (result.first_air_date ? result.first_air_date.split('-')[0] : '');
    const title = result.title || result.name;

    const itemsToUpdate = [sourceItem];
    
    if (autoBatch && sourceItem.parsedTitle) {
        const baseTitle = sourceItem.parsedTitle.toLowerCase().trim();
        items.forEach(i => {
            if (i.id !== sourceItem.id && i.status === 'pending' && i.parsedTitle && i.parsedTitle.toLowerCase().trim() === baseTitle) {
                itemsToUpdate.push(i);
            }
        });
    }

    try {
      await Promise.all(itemsToUpdate.map(i => 
        api.put(`/downloads/${i.id}`, {
          tmdbId: result.id,
          parsedType: sourceItem.parsedType,
          parsedTitle: title,
          parsedYear: parseInt(year, 10) || null,
          parsedSeason: i.parsedSeason,
          parsedEpisode: i.parsedEpisode
        })
      ));
      fetchItems();
    } catch (err) {
      setError('Failed to apply detected TMDB match.');
    }
  };

  const handleSelectTmdbResult = (result) => {
    const year = result.release_date ? result.release_date.split('-')[0] : (result.first_air_date ? result.first_air_date.split('-')[0] : '');
    
    if (tmdbSearchTarget === 'bulk') {
      setBulkEditForm(prev => ({
        ...prev,
        tmdbId: result.id,
        parsedTitle: result.title || result.name,
        parsedYear: year
      }));
    } else if (tmdbSearchTarget === 'single') {
      setEditForm(prev => ({
        ...prev,
        tmdbId: result.id,
        parsedTitle: result.title || result.name,
        parsedYear: year
      }));
    } else if (tmdbSearchTarget?.type === 'detect') {
      applyTmdbResult(result, tmdbSearchTarget.item, true);
    }
    setTmdbSearchOpen(false);
  };

  const startEditing = (item) => {
    setIsEditing(true);
    setEditForm({
      tmdbId: item.tmdbId || '',
      parsedType: item.parsedType || 'movie',
      parsedTitle: item.parsedTitle || '',
      parsedYear: item.parsedYear || '',
      parsedSeason: item.parsedSeason || '',
      parsedEpisode: item.parsedEpisode || ''
    });
  };

  const handleEditSave = async (id) => {
    try {
      await api.put(`/downloads/${id}`, {
        tmdbId: parseInt(editForm.tmdbId, 10) || null,
        parsedType: editForm.parsedType,
        parsedTitle: editForm.parsedTitle,
        parsedYear: parseInt(editForm.parsedYear, 10) || null,
        parsedSeason: editForm.parsedSeason ? parseInt(editForm.parsedSeason, 10) : null,
        parsedEpisode: editForm.parsedEpisode ? parseInt(editForm.parsedEpisode, 10) : null
      });
      setIsEditing(false);
      fetchItems();
    } catch (err) {
      setError('Failed to update item');
    }
  };

  const handlePreviewSort = async (id) => {
    setPreviewLoading(true);
    try {
      const res = await api.post(`/downloads/${id}/sort/preview`);
      setPreviewData({ id, newPath: res.data.newPath, context: res.data.context });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmSort = async () => {
    if (!previewData) return;
    try {
      await api.post(`/downloads/${previewData.id}/sort`, { context: previewData.context });
      setPreviewData(null);
      fetchItems();
      
      // Auto-select next item
      const nextPending = items.find(i => i.id !== previewData.id && i.status === 'pending');
      if (nextPending) {
        setFocusedItemId(nextPending.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sort item');
      setPreviewData(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/downloads/${id}`);
      fetchItems();
    } catch (err) {
      setError('Failed to delete item from staging');
    }
  };

  const handleScan = async () => {
    try {
      const res = await api.post('/downloads/scan');
      setScanMessage(res.data.message);
      setTimeout(() => setScanMessage(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start scan');
    }
  };

  const toggleSelection = (id) => {
    const newSel = new Set(selectedIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedIds(newSel);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleBulkEditSave = async () => {
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => {
        const item = items.find(i => i.id === id);
        return api.put(`/downloads/${id}`, {
          tmdbId: parseInt(bulkEditForm.tmdbId, 10) || item.tmdbId,
          parsedType: bulkEditForm.parsedType,
          parsedTitle: bulkEditForm.parsedTitle || item.parsedTitle,
          parsedYear: bulkEditForm.parsedYear ? parseInt(bulkEditForm.parsedYear, 10) : item.parsedYear,
          parsedSeason: item.parsedSeason,
          parsedEpisode: item.parsedEpisode
        });
      }));
      setBulkEditOpen(false);
      fetchItems();
    } catch (err) {
      setError('Failed to apply bulk edit');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkPreview = async () => {
    setBulkProcessing(true);
    try {
      const previews = await Promise.all(Array.from(selectedIds).map(async (id) => {
        const res = await api.post(`/downloads/${id}/sort/preview`);
        return { id, newPath: res.data.newPath, context: res.data.context };
      }));
      setBulkPreviewData(previews);
    } catch (err) {
      setError('Failed to generate bulk previews. Ensure all selected items have TMDB matches.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkConfirmSort = async () => {
    if (!bulkPreviewData) return;
    setBulkProcessing(true);
    try {
      await Promise.all(bulkPreviewData.map(preview => 
        api.post(`/downloads/${preview.id}/sort`, { context: preview.context })
      ));
      setBulkPreviewData(null);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      setError('Failed to sort some items');
      setBulkPreviewData(null);
      fetchItems();
    } finally {
      setBulkProcessing(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Access Denied</h2>
        <p>Only administrators can access the downloads staging area.</p>
      </div>
    );
  }

  return (
    <div style={{ margin: '0 auto', width: '100%', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FolderSync size={28} style={{ color: 'var(--accent)' }} />
          <h1 style={{ margin: 0 }}>Downloads & Staging</h1>
        </div>
        <button className="btn btn-secondary" onClick={handleScan}>
          <RefreshCw size={16} /> Scan for New Files
        </button>
      </div>
      
      {scanMessage && (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px' }}>
          <CheckCircle2 style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--text-main)' }}>{scanMessage}</span>
        </div>
      )}

      {error && (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--text-main)' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="spin" size={32} style={{ color: 'var(--accent)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success)', margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>All caught up!</h3>
          <p style={{ color: 'var(--text-muted)' }}>There are no pending downloads to process.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0 }}>
          {/* LEFT PANE: Master List */}
          <div className="glass-panel" style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* List Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div onClick={toggleSelectAll} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedIds.size === items.length && items.length > 0 ? <CheckSquare style={{ color: 'var(--accent)' }} /> : <Square style={{ color: 'var(--text-muted)' }} />}
              </div>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Pending ({items.filter(i => i.status === 'pending').length})</span>
              
              {selectedIds.size > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setBulkEditOpen(!bulkEditOpen)} disabled={bulkProcessing}>
                     Bulk Edit
                  </button>
                  <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={handleBulkPreview} disabled={bulkProcessing}>
                     Bulk Sort
                  </button>
                </div>
              )}
            </div>

            {/* List Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {items.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => { setFocusedItemId(item.id); setIsEditing(false); }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border)',
                    background: focusedItemId === item.id ? 'var(--overlay-strong)' : (selectedIds.has(item.id) ? 'var(--overlay-medium)' : 'transparent'),
                    cursor: 'pointer',
                    opacity: item.status === 'sorted' ? 0.5 : 1,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { if (focusedItemId !== item.id && !selectedIds.has(item.id)) e.currentTarget.style.background = 'var(--overlay-medium)' }}
                  onMouseLeave={(e) => { if (focusedItemId !== item.id && !selectedIds.has(item.id)) e.currentTarget.style.background = 'transparent' }}
                >
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }} style={{ cursor: 'pointer' }}>
                    {selectedIds.has(item.id) ? <CheckSquare style={{ color: 'var(--accent)' }} size={18} /> : <Square style={{ color: 'var(--text-muted)' }} size={18} />}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500', fontSize: '0.9rem', color: focusedItemId === item.id ? 'var(--accent)' : 'var(--text-main)' }}>
                      {item.filename}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {item.status === 'sorted' ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    ) : item.tmdbId ? (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', title: 'Matched' }}></div>
                    ) : (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', title: 'Unmatched' }}></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANE: Details */}
          <div className="glass-panel" style={{ flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {focusedItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border)', marginBottom: '24px', flexShrink: 0 }}>
                  <h2 style={{ wordBreak: 'break-all', marginBottom: '8px', fontSize: '1.4rem', lineHeight: 1.3 }}>{focusedItem.filename}</h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{focusedItem.path}</div>
                </div>

                {/* Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', flex: 1, minHeight: 0 }}>
                  
                  {/* TMDB Match Card */}
                  <div style={{ background: 'var(--bg-dark)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} style={{ color: 'var(--accent)' }}/> TMDB Match
                    </h3>
                    
                    {focusedItem.tmdbId ? (
                      <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
                        {focusedItem.tmdbPosterPath ? (
                           <img src={`https://image.tmdb.org/t/p/w154${focusedItem.tmdbPosterPath}`} alt="poster" style={{ width: '120px', height: '180px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }} />
                        ) : (
                           <div style={{ width: '120px', height: '180px', background: 'var(--overlay-strong)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <CheckCircle2 size={40} style={{ color: 'var(--success)' }}/>
                           </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>{focusedItem.tmdbTitle || 'Unknown Title'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>ID: {focusedItem.tmdbId}</div>
                          
                          {focusedItem.status === 'pending' && (
                            <button className="btn btn-secondary" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => openTmdbSearch({ type: 'detect', item: focusedItem }, focusedItem.parsedTitle, focusedItem.parsedType, false)}>
                              <Search size={16} /> Change Match
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px', gap: '16px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px dashed var(--danger)' }}>
                        <AlertCircle size={40} style={{ color: 'var(--danger)', opacity: 0.8 }} />
                        <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '1.1rem' }}>No TMDB Match</div>
                        {focusedItem.status === 'pending' && (
                          <button className="btn btn-primary" onClick={() => handleDetect(focusedItem)}>
                            <Crosshair size={18} /> Auto-Detect Match
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extracted Metadata Card */}
                  <div style={{ background: 'var(--bg-dark)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Edit2 size={18} style={{ color: 'var(--accent)' }}/> Extracted Metadata
                      </h3>
                      {!isEditing && focusedItem.status === 'pending' && (
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => startEditing(focusedItem)}>
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Type</label>
                          <select className="input-field" value={editForm.parsedType} onChange={e => setEditForm({ ...editForm, parsedType: e.target.value })}>
                            <option value="movie">Movie</option>
                            <option value="tv">TV</option>
                          </select>
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Title</label>
                          <input className="input-field" value={editForm.parsedTitle} onChange={e => setEditForm({ ...editForm, parsedTitle: e.target.value })} />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>Year</label>
                          <input type="number" className="input-field" value={editForm.parsedYear} onChange={e => setEditForm({ ...editForm, parsedYear: e.target.value })} />
                        </div>
                        {editForm.parsedType === 'tv' && (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                              <label>Season</label>
                              <input type="number" className="input-field" value={editForm.parsedSeason} onChange={e => setEditForm({ ...editForm, parsedSeason: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                              <label>Episode</label>
                              <input type="number" className="input-field" value={editForm.parsedEpisode} onChange={e => setEditForm({ ...editForm, parsedEpisode: e.target.value })} />
                            </div>
                          </div>
                        )}
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label>TMDB ID</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="number" className="input-field" style={{ flex: 1 }} value={editForm.tmdbId} onChange={e => setEditForm({ ...editForm, tmdbId: e.target.value })} />
                            <button className="btn btn-secondary" onClick={() => openTmdbSearch('single', editForm.parsedTitle, editForm.parsedType)}><Search size={16} /></button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleEditSave(focusedItem.id)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignContent: 'start' }}>
                        <div style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Type</div>
                          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{focusedItem.parsedType === 'tv' ? 'TV' : 'Movie'}</div>
                        </div>
                        <div style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Year</div>
                          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{focusedItem.parsedYear || '-'}</div>
                        </div>
                        <div style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px', gridColumn: '1 / -1' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Title</div>
                          <div style={{ fontWeight: 600, fontSize: '1.1rem', wordBreak: 'break-word' }}>{focusedItem.parsedTitle || '-'}</div>
                        </div>
                        {focusedItem.parsedType === 'tv' && (
                          <>
                            <div style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Season</div>
                              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{focusedItem.parsedSeason !== null ? focusedItem.parsedSeason : '-'}</div>
                            </div>
                            <div style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Episode</div>
                              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{focusedItem.parsedEpisode !== null ? focusedItem.parsedEpisode : '-'}</div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                {focusedItem.status === 'pending' && (
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '16px', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button className="btn" style={{ padding: '12px 24px', color: 'var(--danger)', background: 'var(--bg-dark)', border: '1px solid var(--border)' }} onClick={() => { handleDelete(focusedItem.id); setFocusedItemId(null); }}>
                      <Trash2 size={18} /> Delete
                    </button>
                    <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => handlePreviewSort(focusedItem.id)} disabled={!focusedItem.tmdbId || previewLoading}>
                      <Play size={18} /> Preview & Sort
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Select an item from the list to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Preview Modal (Same as before) */}
      {bulkPreviewData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '20px' }}>Bulk Preview Sort</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {bulkPreviewData.map(preview => (
                <div key={preview.id} style={{ background: 'var(--overlay-medium)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Original filename: {items.find(i => i.id === preview.id)?.filename}</div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-main)', wordBreak: 'break-all' }}><strong>New Path:</strong> {preview.newPath}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setBulkPreviewData(null)} disabled={bulkProcessing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkConfirmSort} disabled={bulkProcessing}>
                {bulkProcessing ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />} Confirm Sort All
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Edit Modal (Similar logic, simplified) */}
      {bulkEditOpen && selectedIds.size > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px' }}>
             <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Edit2 size={20} /> Bulk Edit ({selectedIds.size} items)</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Apply Type</label>
                  <select className="input-field" value={bulkEditForm.parsedType} onChange={e => setBulkEditForm({ ...bulkEditForm, parsedType: e.target.value })}>
                    <option value="movie">Movie</option>
                    <option value="tv">TV</option>
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Apply Title</label>
                  <input className="input-field" placeholder="Leave blank to keep original" value={bulkEditForm.parsedTitle} onChange={e => setBulkEditForm({ ...bulkEditForm, parsedTitle: e.target.value })} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Apply Year</label>
                  <input type="number" className="input-field" placeholder="Optional" value={bulkEditForm.parsedYear} onChange={e => setBulkEditForm({ ...bulkEditForm, parsedYear: e.target.value })} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Apply TMDB ID</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" className="input-field" placeholder="Optional" value={bulkEditForm.tmdbId} onChange={e => setBulkEditForm({ ...bulkEditForm, tmdbId: e.target.value })} />
                    <button className="btn btn-secondary" onClick={() => openTmdbSearch('bulk', bulkEditForm.parsedTitle, bulkEditForm.parsedType)}><Search size={16} /></button>
                  </div>
                </div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
               <button className="btn btn-secondary" onClick={() => setBulkEditOpen(false)} disabled={bulkProcessing}>Cancel</button>
               <button className="btn btn-primary" onClick={handleBulkEditSave} disabled={bulkProcessing}>
                 {bulkProcessing ? <RefreshCw className="spin" size={16} /> : <Check size={16} />} Apply to Selected
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '600px', padding: '32px' }}>
            <h2 style={{ marginBottom: '8px' }}>Confirm Sort & Rename</h2>
            <p style={{ color: 'var(--text-muted)' }}>Review the extracted details and the final path before moving the file.</p>
            
            <div style={{ background: 'var(--overlay-strong)', padding: '16px', borderRadius: '8px', margin: '20px 0' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Resolution:</span> <span style={{ fontWeight: 600 }}>{previewData.context.resolution}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Video Codec:</span> <span style={{ fontWeight: 600 }}>{previewData.context.videoCodec}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Genre:</span> <span style={{ fontWeight: 600 }}>{previewData.context.genre}</span>
              </div>
              {previewData.context.type === 'tv' && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Episode Title:</span> <span style={{ fontWeight: 600 }}>{previewData.context.episodeTitle}</span>
                </div>
              )}
              <hr style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />
              <div>
                <span style={{ color: 'var(--text-muted)' }}>New Path:</span>
                <div style={{ background: 'var(--overlay-medium)', padding: '12px', borderRadius: '6px', marginTop: '8px', wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {previewData.newPath}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPreviewData(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmSort}>Confirm & Move</button>
            </div>
          </div>
        </div>
      )}

      {/* TMDB Search Modal */}
      {tmdbSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Search TMDB</h2>
              <button className="btn btn-secondary" onClick={() => setTmdbSearchOpen(false)}>Close</button>
            </div>
            
            <form onSubmit={(e) => executeTmdbSearch(e)} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <select className="input-field" style={{ width: '120px' }} value={tmdbSearchType} onChange={e => setTmdbSearchType(e.target.value)}>
                <option value="tv">TV Show</option>
                <option value="movie">Movie</option>
              </select>
              <input className="input-field" style={{ flex: 1 }} placeholder="Search title..." value={tmdbSearchQuery} onChange={e => setTmdbSearchQuery(e.target.value)} autoFocus />
              <button type="submit" className="btn btn-primary" disabled={tmdbSearchLoading}>
                {tmdbSearchLoading ? <RefreshCw className="spin" size={16} /> : <Search size={16} />} Search
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tmdbSearchResults.map(result => (
                <div key={result.id} className="glass-panel" style={{ display: 'flex', gap: '16px', cursor: 'pointer', background: 'var(--overlay-medium)', transition: 'background 0.2s' }} onClick={() => handleSelectTmdbResult(result)} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--overlay-strong)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--overlay-medium)'}>
                  {result.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} alt="poster" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '60px', height: '90px', background: 'var(--bg-dark)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Img</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{result.title || result.name} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({result.release_date ? result.release_date.split('-')[0] : (result.first_air_date ? result.first_air_date.split('-')[0] : 'N/A')})</span></h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {result.overview}
                    </p>
                  </div>
                </div>
              ))}
              {!tmdbSearchLoading && tmdbSearchResults.length === 0 && tmdbSearchQuery && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No results found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Downloads;

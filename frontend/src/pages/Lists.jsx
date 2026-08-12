import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Plus, Trash2, Edit2, Lock, Link as LinkIcon, Globe, List as ListIcon } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import ListConfigModal from '../components/ListConfigModal';
import { useModal } from '../context/ModalContext';

const Lists = () => {
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [lists, setLists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    }
  };

  const handleDeleteList = async (e, listId) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm("Are you sure you want to delete this list?")) {
      try {
        await api.delete(`/lists/${listId}`);
        fetchLists();
        showAlert('List deleted', 'success');
      } catch (err) {
        console.error('Failed to delete list:', err);
        showAlert('Failed to delete list', 'error');
      }
    }
  };

  const handleEditList = (e, list) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingList(list);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingList(null);
    setIsModalOpen(true);
  };

  const renderVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'PUBLIC': return <Globe size={14} title="Public" />;
      case 'LINK': return <LinkIcon size={14} title="Anyone with link" />;
      default: return <Lock size={14} title="Invite only" />;
    }
  };

  return (
    <div className="media-page-container">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <ListIcon style={{ color: 'var(--accent)' }} size={28} />
          My Lists
        </h1>
        
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          Create List
        </button>
      </div>

      {lists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ListIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3>No lists found</h3>
          <p>Create a list to start organizing your favorite movies and shows.</p>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 455px), 1fr))', 
        gap: '24px', 
        marginTop: '24px' 
      }}>
        {lists.map(list => {
          // Get up to 4 poster images
          const previewItems = list.items.slice(0, 4);
          const posters = previewItems.map(item => item.media.posterPath).filter(Boolean);
          
          return (
            <Link 
              to={`/lists/${list.shareId}`} 
              key={list.id} 
              className="glass-panel" 
              style={{ 
                display: 'flex', 
                flexDirection: 'row',
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                height: '200px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                width: '140px',
                minWidth: '140px',
                flexShrink: 0,
                height: '200px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.15)',
                borderRight: '1px solid rgba(255,255,255,0.05)'
              }}>
                {posters.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Empty
                  </div>
                )}
                {posters.slice().reverse().map((poster, reversedIdx) => {
                  const idx = posters.length - 1 - reversedIdx;
                  // Card fan effects
                  const rotations = [0, 6, -6, 10];
                  const xOffsets = [0, 8, -8, 14];
                  const yOffsets = [-25, -23, -21, -19];
                  
                  return (
                    <div key={idx} style={{ 
                      position: 'absolute', 
                      width: '100px', 
                      height: '150px', 
                      zIndex: 10 - idx,
                      transform: `translate(${xOffsets[idx] || 0}px, ${yOffsets[idx] || 0}px) rotate(${rotations[idx] || 0}deg)`,
                      transformOrigin: 'center center',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      backgroundColor: 'var(--panel-bg)'
                    }}>
                      <img 
                        src={`https://image.tmdb.org/t/p/w300${poster}`} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    </div>
                  );
                })}
              </div>
              
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '700', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {list.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)' }}>
                    {renderVisibilityIcon(list.visibility)}
                  </div>
                </div>
                
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>
                  {list.items.length} {list.items.length === 1 ? 'item' : 'items'}
                </span>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button 
                    onClick={(e) => handleEditList(e, list)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Edit List"
                  >
                    <Edit2 size={14} />
                    <span>Edit</span>
                  </button>
                  {list.name !== 'Watchlist' && (
                    <button 
                      onClick={(e) => handleDeleteList(e, list.id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', borderRadius: '8px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Delete List"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <ListConfigModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        list={editingList}
        onSuccess={fetchLists}
      />
    </div>
  );
};

export default Lists;

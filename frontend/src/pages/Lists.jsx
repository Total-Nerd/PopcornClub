import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Plus, Trash2, Edit2, Lock, Link as LinkIcon, Globe, List as ListIcon, UserMinus, Check, X, Users } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import ListConfigModal from '../components/ListConfigModal';
import { useModal } from '../context/ModalContext';
import { AuthContext } from '../context/AuthContext';

const Lists = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const { user } = React.useContext(AuthContext);
  const [lists, setLists] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      const res = await api.get('/lists');
      setLists(res.data);
      const sharedRes = await api.get('/lists/shared-with-me').catch(() => ({ data: [] }));
      if (sharedRes.data) setSharedLists(sharedRes.data);
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

  const handleRespondToInvite = async (e, listId, accept) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.post(`/lists/shared/${listId}/respond`, { accept });
      fetchLists();
      showAlert(accept ? 'Joined list!' : 'Declined list invitation.', 'success');
    } catch (err) {
      console.error('Failed to respond to invite:', err);
      showAlert('Failed to respond to invitation', 'error');
    }
  };

  const handleLeaveList = async (e, listId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to leave this shared list?")) {
      try {
        await api.post(`/lists/shared/${listId}/respond`, { accept: false });
        fetchLists();
        showAlert('Left the shared list.', 'success');
      } catch (err) {
        console.error('Failed to leave list:', err);
        showAlert('Failed to leave list', 'error');
      }
    }
  };

  const openCreateModal = () => {
    setEditingList(null);
    setIsModalOpen(true);
  };

  const renderVisibilityIcon = (list) => {
    if (list.visibility === 'PUBLIC') return <Globe size={14} title="Public" />;
    if (list.visibility === 'LINK') return <LinkIcon size={14} title="Anyone with link" />;
    
    let isShared = false;
    try {
      const arr = typeof list.sharedWith === 'string' ? JSON.parse(list.sharedWith || '[]') : list.sharedWith;
      if (arr && arr.length > 0) isShared = true;
    } catch(e) {}
    
    if (isShared) return <Users size={14} title="Shared with users" />;
    return <Lock size={14} title="Private" />;
  };

  const renderListCard = (list, isShared = false) => {
    const previewItems = list.items.slice(0, 4);
    const posters = previewItems.map(item => item.media.posterPath).filter(Boolean);
    
    let isPending = false;
    if (isShared && user) {
      const sharedWithArr = typeof list.sharedWith === 'string' ? JSON.parse(list.sharedWith || '[]') : list.sharedWith;
      const myShare = sharedWithArr.find(share => (typeof share === 'object' ? share.id === user.id : share === user.id));
      isPending = myShare && myShare.status === 'pending';
    }

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
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '700', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {list.name}
              </h3>
              {isShared && list.user && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Created by {list.user.username}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)' }}>
              {renderVisibilityIcon(list)}
            </div>
          </div>
          
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>
            {list.items.length} {list.items.length === 1 ? 'item' : 'items'}
          </span>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {!isShared && (
              <>
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
              </>
            )}
            
            {isShared && isPending && (
              <>
                <button 
                  onClick={(e) => handleRespondToInvite(e, list.shareId, true)}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} />
                  <span>Accept</span>
                </button>
                <button 
                  onClick={(e) => handleRespondToInvite(e, list.shareId, false)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', borderRadius: '8px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <X size={14} />
                  <span>Reject</span>
                </button>
              </>
            )}
            
            {isShared && !isPending && (
              <button 
                onClick={(e) => handleLeaveList(e, list.shareId)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', borderRadius: '8px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Leave List"
              >
                <UserMinus size={14} />
                <span>Leave</span>
              </button>
            )}
          </div>
        </div>
      </Link>
    );
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

      {lists.length === 0 && sharedLists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ListIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3>No lists found</h3>
          <p>Create a list to start organizing your favorite movies and shows.</p>
        </div>
      )}

      {lists.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 455px), 1fr))', 
          gap: '24px', 
          marginTop: '24px' 
        }}>
          {lists.map(list => renderListCard(list, false))}
        </div>
      )}

      {sharedLists.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: '40px' }}>
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
              <LinkIcon style={{ color: 'var(--accent)' }} size={24} />
              Shared Lists
            </h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 455px), 1fr))', 
            gap: '24px', 
            marginTop: '24px' 
          }}>
            {sharedLists.map(list => renderListCard(list, true))}
          </div>
        </>
      )}

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

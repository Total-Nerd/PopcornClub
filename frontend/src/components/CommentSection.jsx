import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Send, AlertTriangle, Trash2, Edit2, MessageSquare } from 'lucide-react';
import api from '../api';

const CommentSection = ({ mediaId, mediaType, listId, season, episode, isGlobalMediaView = false }) => {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Local state for tracking which spoiler comments the user manually unblurred
  const [unblurred, setUnblurred] = useState(new Set());

  useEffect(() => {
    fetchComments();
  }, [mediaId, listId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const url = mediaId 
        ? `/comments/media/${mediaId}?mediaType=${mediaType || ''}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}` 
        : `/comments/list/${listId}`;
      const res = await api.get(url);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const payload = {
        mediaId,
        mediaType,
        listId,
        season,
        episode,
        content: newComment,
        hasSpoilers
      };
      const res = await api.post('/comments', payload);
      setComments([res.data, ...comments]);
      setNewComment('');
      setHasSpoilers(false);
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/comments/${id}`);
      setComments(comments.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const toggleUnblur = (id) => {
    setUnblurred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="comment-section" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <MessageSquare size={20} style={{ color: 'var(--accent)' }}/>
        Comments & Discussions
      </h3>

      {/* Post Box */}
      {user && (
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--overlay-medium)', padding: '16px', borderRadius: '12px' }}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--overlay-strong)',
              color: 'var(--text-main)',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={hasSpoilers} 
                onChange={(e) => setHasSpoilers(e.target.checked)} 
                style={{ accentColor: 'var(--danger)', width: '16px', height: '16px' }}
              />
              <AlertTriangle size={16} style={{ color: hasSpoilers ? 'var(--danger)' : 'var(--text-muted)' }}/>
              Contains Spoilers
            </label>
            <button type="submit" className="btn btn-primary" disabled={!newComment.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={16} /> Post
            </button>
          </div>
        </form>
      )}

      {/* Comment List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading comments...</div>
        ) : comments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', background: 'var(--overlay-light)', borderRadius: '8px' }}>
            No comments yet. Be the first to start the discussion!
          </div>
        ) : (
          comments.map(comment => {
            const isSpoiler = comment.hasSpoilers;
            const globalShowSpoilers = user?.showSpoilers;
            const locallyUnblurred = unblurred.has(comment.id);
            
            // Should the comment be hidden behind a spoiler overlay?
            const isHidden = isSpoiler && !globalShowSpoilers && !locallyUnblurred;
            const canDelete = user?.role === 'admin' || user?.id === comment.userId;

            return (
              <div key={comment.id} style={{ display: 'flex', gap: '12px', background: 'var(--overlay-light)', padding: '16px', borderRadius: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--overlay-strong)', flexShrink: 0, overflow: 'hidden' }}>
                  {comment.user.avatarPath ? (
                    <img src={comment.user.avatarPath} alt={comment.user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {comment.user.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600' }}>{comment.user.username}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      {isGlobalMediaView && comment.season != null && comment.episode != null && (
                        <Link to={`/shows/${mediaId}/season/${comment.season}/episode/${comment.episode}`} style={{ textDecoration: 'none' }}>
                          <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            S{String(comment.season).padStart(2, '0')}E{String(comment.episode).padStart(2, '0')}
                          </span>
                        </Link>
                      )}
                    </div>
                    {canDelete && (
                      <button onClick={() => handleDelete(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.7 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <p style={{ 
                      whiteSpace: 'pre-wrap', 
                      margin: 0, 
                      lineHeight: '1.5',
                      filter: isHidden ? 'blur(5px)' : 'none',
                      transition: 'filter 0.2s',
                      userSelect: isHidden ? 'none' : 'auto'
                    }}>
                      {comment.content}
                    </p>
                    
                    {isHidden && (
                      <div 
                        onClick={() => toggleUnblur(comment.id)}
                        style={{ 
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          cursor: 'pointer', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' 
                        }}
                      >
                        <span style={{ background: 'var(--overlay-strong)', padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                          Spoiler - Click to view
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommentSection;

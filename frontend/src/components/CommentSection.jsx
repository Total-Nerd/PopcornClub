import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Send, AlertTriangle, Trash2, Edit2, MessageSquare } from 'lucide-react';
import api from '../api';

const CommentSection = ({ mediaId, mediaType, listId, season, episode, isGlobalMediaView = false }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Local state for tracking which spoiler comments the user manually unblurred
  const [unblurred, setUnblurred] = useState(new Set());

  // Autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);

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

  useEffect(() => {
    if (!loading && comments.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const commentIdStr = searchParams.get('comment');
      if (commentIdStr) {
        const commentId = parseInt(commentIdStr, 10);
        const commentElement = document.getElementById(`comment-${commentId}`);
        if (commentElement) {
          setTimeout(() => {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            commentElement.classList.add('highlight-comment');
            setTimeout(() => {
              commentElement.classList.remove('highlight-comment');
            }, 3000);
          }, 300);
        }
      }
    }
  }, [loading, comments, location.search]);

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

  const handleKeyDown = (e) => {
    if (mentionQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === 'Enter' && mentionResults.length > 0) {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex].username);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  const handleInputChange = async (e) => {
    const val = e.target.value;
    setNewComment(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    if (match) {
      const q = match[1];
      setMentionQuery(q);
      setMentionIndex(0);
      try {
        if (q.trim()) {
          const res = await api.get(`/social/users/search?q=${encodeURIComponent(q)}`);
          setMentionResults(res.data);
        } else {
          const res = await api.get('/social/following');
          setMentionResults(res.data);
        }
      } catch (err) {
        console.error('Mention search failed', err);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (username) => {
    const textarea = document.getElementById(`comment-input-${mediaId || listId}`);
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    
    const beforeMention = textBeforeCursor.replace(/@[a-zA-Z0-9_-]*$/, '');
    const newText = `${beforeMention}@${username} ${textAfterCursor}`;
    setNewComment(newText);
    setMentionQuery(null);
    
    // Focus back and move cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = beforeMention.length + username.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const renderCommentContent = (comment) => {
    const content = comment.content;
    if (!content) return null;
    
    const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (part.match(mentionRegex)) {
        const username = part.substring(1);
        const mentionedUser = comment.mentionedUsers?.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        return (
          <span key={index} style={{ 
            color: 'var(--text-main)', 
            fontWeight: '600', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            background: 'var(--overlay-medium)',
            padding: mentionedUser ? '2px 8px 2px 4px' : '2px 8px',
            borderRadius: '16px',
            verticalAlign: 'middle',
            border: '1px solid var(--accent)',
            fontSize: '0.9em',
            margin: '0 2px'
          }}>
            {mentionedUser && (
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--overlay-strong)', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
                {mentionedUser.avatarPath ? (
                  <img src={mentionedUser.avatarPath} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>
                    {username.substring(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
            )}
            {part}
          </span>
        );
      }
      return part;
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
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--overlay-medium)', padding: '16px', borderRadius: '12px', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              id={`comment-input-${mediaId || listId}`}
              value={newComment}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
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
            {mentionQuery !== null && mentionResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                maxHeight: '200px',
                overflowY: 'auto',
                background: '#1e1e1e', // Fully opaque background
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                marginTop: '4px'
              }}>
                {mentionResults.map((u, i) => (
                  <div
                    key={u.id}
                    onClick={() => insertMention(u.username)}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: i === mentionIndex ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--overlay-strong)', overflow: 'hidden' }}>
                      {u.avatarPath ? (
                        <img src={u.avatarPath} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 'bold' }}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              <div id={`comment-${comment.id}`} key={comment.id} style={{ display: 'flex', gap: '12px', background: 'var(--overlay-light)', padding: '16px', borderRadius: '12px', transition: 'background-color 0.5s' }}>
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
                      {renderCommentContent(comment)}
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

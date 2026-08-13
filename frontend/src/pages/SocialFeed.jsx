import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Users, Search, UserPlus, UserMinus, Play, Film, Tv, Clock } from 'lucide-react';
import api from '../api';

const SocialFeed = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [followingList, setFollowingList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchFeed();
  }, [user, navigate, selectedUserId]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const res = await api.get(selectedUserId ? `/social/feed?userId=${selectedUserId}` : '/social/feed');
      setFeed(res.data);
      if (!selectedUserId) {
        const followingRes = await api.get('/social/following');
        setFollowingList(followingRes.data);
      }
    } catch (err) {
      console.error('Failed to load social feed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await api.get(`/social/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearching(false);
    }
  };

  const toggleFollow = async (targetUser) => {
    try {
      if (targetUser.isFollowing) {
        await api.delete(`/social/unfollow/${targetUser.id}`);
      } else {
        await api.post(`/social/follow/${targetUser.id}`);
      }
      
      // Update local state
      setSearchResults(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, isFollowing: !u.isFollowing } : u
      ));
      
      fetchFeed();
    } catch (err) {
      console.error('Failed to toggle follow status', err);
    }
  };

  const renderCommentContent = (content, mentionedUsers = []) => {
    if (!content) return null;
    
    const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (part.match(mentionRegex)) {
        const username = part.substring(1);
        const mentionedUser = mentionedUsers?.find(u => u.username.toLowerCase() === username.toLowerCase());
        
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

  if (!user) return null;

  return (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Users size={28} style={{ color: 'var(--accent)' }} />
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>
          {selectedUserId ? `${followingList.find(u => u.id === selectedUserId)?.username}'s Activity` : 'Friends Activity'}
        </h1>
        {selectedUserId && (
          <button onClick={() => setSelectedUserId(null)} className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.85rem' }}>
            View All Friends
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Column: Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading activity feed...</div>
          ) : feed.length === 0 ? (
            <div style={{ background: 'var(--overlay-light)', padding: '32px', borderRadius: '12px', textAlign: 'center' }}>
              <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0' }}>Your feed is quiet</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Follow some friends to see what they are watching!</p>
            </div>
          ) : (
            feed.map(item => (
              <div key={item.id} style={{ background: 'var(--overlay-medium)', borderRadius: '12px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border-color)' }}>
                {/* Poster Thumbnail */}
                <Link to={item.media.type === 'movie' ? `/movies/${item.media.tmdbId || item.media.id}` : `/shows/${item.media.tmdbId || item.media.id}`} style={{ width: '100px', flexShrink: 0, display: 'block', background: 'var(--bg-input)' }}>
                  {item.media.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w185${item.media.posterPath}`} alt={item.media.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      {item.media.type === 'movie' ? <Film size={24} /> : <Tv size={24} />}
                    </div>
                  )}
                </Link>

                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--overlay-strong)', overflow: 'hidden' }}>
                      {item.user.avatarPath ? (
                        <img src={item.user.avatarPath} alt={item.user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {item.user.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.user.username}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.05rem' }}>
                    {item.type === 'watch' && 'watched '}
                    {item.type === 'reaction' && `reacted with ${item.emoji} to `}
                    {item.type === 'comment' && 'commented on '}
                    <Link to={item.media.type === 'movie' ? `/movies/${item.media.tmdbId || item.media.id}` : `/shows/${item.media.tmdbId || item.media.id}`} style={{ color: 'var(--accent)', fontWeight: '600', textDecoration: 'none' }}>
                      {item.media.title}
                    </Link>
                  </div>
                  
                  {item.type === 'comment' && item.content && (
                    <Link to={item.media.type === 'movie' ? `/movies/${item.media.tmdbId || item.media.id}?comment=${item.id.replace('comment_', '')}` : `/shows/${item.media.tmdbId || item.media.id}${item.season ? `/season/${item.season}/episode/${item.episode}` : ''}?comment=${item.id.replace('comment_', '')}`} style={{ textDecoration: 'none' }}>
                      <div style={{ background: 'var(--overlay-strong)', padding: '8px 12px', borderRadius: '8px', marginTop: '8px', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        "{renderCommentContent(item.content, item.mentionedUsers)}"
                      </div>
                    </Link>
                  )}

                  {item.media.type === 'tv' && item.season != null && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                      Season {item.season} {item.episode != null ? `Episode ${item.episode}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Find Friends */}
        <div style={{ background: 'var(--overlay-light)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'sticky', top: '100px' }}>
          {followingList.length > 0 && !searchQuery && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-muted)' }}>Following</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {followingList.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', 
                      background: selectedUserId === u.id ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--overlay-medium)', 
                      border: `1px solid ${selectedUserId === u.id ? 'var(--accent)' : 'transparent'}`,
                      borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' 
                    }}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--overlay-strong)', overflow: 'hidden' }}>
                      {u.avatarPath ? (
                        <img src={u.avatarPath} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: '500', fontSize: '0.9rem', color: selectedUserId === u.id ? 'var(--accent)' : 'var(--text-main)' }}>
                      {u.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} style={{ color: 'var(--text-muted)' }} /> Find Friends
          </h3>
          
          <input
            type="text"
            placeholder="Search username..."
            value={searchQuery}
            onChange={handleSearch}
            className="input-field"
            style={{ width: '100%', marginBottom: '16px' }}
          />

          {searchQuery && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searching ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>Searching...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>No users found</div>
              ) : (
                searchResults.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'var(--overlay-medium)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--overlay-strong)', overflow: 'hidden' }}>
                        {u.avatarPath ? (
                          <img src={u.avatarPath} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{u.username}</span>
                    </div>
                    
                    <button
                      onClick={() => toggleFollow(u)}
                      className="btn"
                      style={{ 
                        padding: '6px', 
                        borderRadius: '50%',
                        background: u.isFollowing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: u.isFollowing ? 'var(--danger)' : 'var(--accent)',
                      }}
                      title={u.isFollowing ? 'Unfollow' : 'Follow'}
                    >
                      {u.isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile override for grid */}
      <style>{`
        @media (max-width: 768px) {
          .page-container > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
          .page-container > div:nth-child(2) > div:nth-child(2) {
            position: static !important;
            order: -1;
          }
        }
      `}</style>
    </div>
  );
};

export default SocialFeed;

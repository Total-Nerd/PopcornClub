import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

const ReactionPicker = ({ mediaId, mediaType, season, episode }) => {
  const { user } = useContext(AuthContext);
  const [counts, setCounts] = useState({});
  const [userReacted, setUserReacted] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReactions();
  }, [mediaId, season, episode]);

  const fetchReactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (season) params.append('season', season);
      if (episode) params.append('episode', episode);
      if (mediaType) params.append('mediaType', mediaType);
      
      const res = await api.get(`/reactions/media/${mediaId}?${params.toString()}`);
      setCounts(res.data.counts || {});
      setUserReacted(res.data.userReacted || {});
    } catch (err) {
      console.error('Failed to load reactions', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleReaction = async (emoji) => {
    if (!user) return;
    
    // Optimistic update
    const isReacted = userReacted[emoji];
    setUserReacted(prev => ({ ...prev, [emoji]: !isReacted }));
    setCounts(prev => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] || 0) + (isReacted ? -1 : 1))
    }));

    try {
      await api.post('/reactions', { mediaId, mediaType, season, episode, emoji });
    } catch (err) {
      console.error('Failed to toggle reaction', err);
      // Revert on error
      fetchReactions();
    }
  };

  if (loading && Object.keys(counts).length === 0) {
    return <div style={{ height: '32px' }} />;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      {EMOJIS.map(emoji => {
        const count = counts[emoji] || 0;
        const reacted = userReacted[emoji];
        
        // Only show emojis that have > 0 counts, OR show all if the user wants to pick one (we'll just show all for simplicity, or we can hide 0 counts until hover. Let's just show all for now.)
        if (count === 0 && !reacted && !user) return null; // hide 0 counts for logged out

        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            disabled={!user}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '20px',
              border: `1px solid ${reacted ? 'var(--accent)' : 'var(--border-color)'}`,
              background: reacted ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--overlay-medium)',
              cursor: user ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
            {count > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ReactionPicker;

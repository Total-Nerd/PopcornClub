import React, { useState, useEffect } from 'react';
import { EyeOff, Ghost } from 'lucide-react';
import api from '../../../api';

const HiddenTab = () => {
  const [hiddenItems, setHiddenItems] = useState([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const fetchHiddenItems = async () => {
    try {
      const res = await api.get('/media/hidden-items');
      setHiddenItems(res.data);
    } catch (err) {
      console.error('Failed to fetch hidden items', err);
    }
  };

  useEffect(() => {
    fetchHiddenItems();
  }, []);

  const handleUnhideItem = async (item) => {
    try {
      await api.post('/media/hide', {
        tmdbId: item.media.tmdbId,
        type: item.media.type,
        title: item.media.title,
        unhide: true
      });
      setHiddenItems(prev => prev.filter(i => i.id !== item.id));
      setMessage(`Unhid ${item.media.title} successfully`);
      setIsError(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setIsError(true);
      setMessage('Failed to unhide item');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ghost size={20} style={{ color: 'var(--accent)' }} />
          <span>Hidden Items</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Manage movies and TV shows you have hidden from the library or calendar.
        </p>
      </div>

      {message && (
        <div style={{ padding: '12px', background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: isError ? 'var(--danger)' : 'var(--success)', borderRadius: '8px', border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}`, fontSize: '0.9rem' }}>
          {message}
        </div>
      )}

      {hiddenItems.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: 'var(--overlay-subtle)', borderRadius: '12px', border: '1px dashed var(--border-color)', gap: '12px' }}>
          <EyeOff size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>You don't have any hidden items.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {hiddenItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--overlay)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {item.media.posterPath ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w92${item.media.posterPath}`} 
                    alt={item.media.title} 
                    style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '72px', background: 'var(--overlay-strong)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No Img</span>
                  </div>
                )}
                <div>
                  <h4 style={{ margin: '0 0 4px' }}>{item.media.title}</h4>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span style={{ background: 'var(--overlay-strong)', padding: '2px 6px', borderRadius: '4px' }}>{item.media.type === 'tv' ? 'Show' : 'Movie'}</span>
                    {item.hideInCalendar && <span>Hidden in Calendar</span>}
                    {item.hideInLibrary && <span>Hidden in Library</span>}
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleUnhideItem(item)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
              >
                <EyeOff size={16} />
                Unhide
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HiddenTab;

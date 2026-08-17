import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv, Check, Play, Users, Trash2 } from 'lucide-react';
import LazyImage from '../../../components/LazyImage';
import { useHistoryStore } from '../store/useHistoryStore';
import { formatDateTime, formatDurationWithSeconds } from '../utils';
import { useModal } from '../../../context/ModalContext';

const HistoryLogItem = ({ log }) => {
  const { showPosters, selectedLogIds, toggleLogSelection, openShareModal, deleteLog } = useHistoryStore();
  const { showConfirm, showAlert } = useModal();

  const isMovie = log.type === 'movie';
  const detailUrl = isMovie ? `/movies/${log.media.tmdbId}` : `/shows/${log.media.tmdbId}`;
  const pct = log.duration > 0 ? Math.round((log.viewOffset / log.duration) * 100) : 0;
  const isSelected = selectedLogIds.includes(log.id);

  const handleDelete = async () => {
    const confirmed = await showConfirm('Are you sure you want to delete this watch history entry?');
    if (!confirmed) return;
    try {
      await deleteLog(log.id);
      showAlert('Watch history entry deleted successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete history log:', err);
      showAlert('Failed to delete watch history log.', 'error');
    }
  };

  return (
    <tr style={{ background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined }}>
      <td style={{ textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleLogSelection(log.id)}
          style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--accent)' }}
        />
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {showPosters && (
            <Link
              to={detailUrl}
              style={{
                width: '40px',
                height: '56px',
                flexShrink: 0,
                borderRadius: '6px',
                overflow: 'hidden',
                background: 'var(--overlay-medium)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'block'
              }}
            >
              {log.media.posterPath ? (
                <LazyImage
                  src={`https://image.tmdb.org/t/p/w92${log.media.posterPath}`}
                  alt={log.media.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  {isMovie ? <Film size={18} /> : <Tv size={18} />}
                </div>
              )}
            </Link>
          )}
          <div>
            <Link to={detailUrl} style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.98rem' }} className="hover-underline">
              {log.media.title}
            </Link>
            {!isMovie && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>
                Season {log.season}, Episode {log.episode}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isMovie ? <Film size={14} /> : <Tv size={14} />}
          {isMovie ? 'Movie' : 'TV Show'}
        </span>
      </td>
      <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        {formatDateTime(log.watchedAt)}
      </td>
      <td>
        {log.isCompleted ? (
          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
            {formatDurationWithSeconds(log.duration)}
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '150px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              {formatDurationWithSeconds(log.viewOffset)} / {formatDurationWithSeconds(log.duration)} ({pct}%)
            </span>
            <div style={{ width: '100%', height: '6px', background: 'var(--overlay-medium)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
            </div>
          </div>
        )}
      </td>
      <td>
        {log.isCompleted ? (
          <span className="badge badge-success">
            <Check size={12} />
            Completed
          </span>
        ) : (
          <span className="badge badge-warning">
            <Play size={12} />
            Partial
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => openShareModal([log.id])}
            style={{
              color: 'var(--accent)',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              padding: '6px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            title={
              log.watchedWithUsers && log.watchedWithUsers.length > 0
                ? `Watched with ${log.watchedWithUsers.map(u => u.name || u.username).join(', ')}`
                : "Watched Together / Share"
            }
          >
            <Users size={15} />
            <span>Together</span>
            {log.watchedWithUsers && log.watchedWithUsers.length > 0 && (
              <div style={{ display: 'flex', marginLeft: '4px', gap: '2px', alignItems: 'center' }}>
                {log.watchedWithUsers.map(u => (
                  <div
                    key={u.id}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      border: '1.5px solid var(--panel-bg)'
                    }}
                  >
                    {u.avatarPath ? (
                      <img
                        src={u.avatarPath}
                        alt={u.username}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.parentElement) {
                            e.currentTarget.parentElement.innerText = u.username.substring(0, 2).toUpperCase();
                          }
                        }}
                        style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                      />
                    ) : (
                      u.username.substring(0, 2).toUpperCase()
                    )}
                  </div>
                ))}
              </div>
            )}
          </button>
          <button
            onClick={handleDelete}
            style={{
              color: 'var(--danger)',
              opacity: 0.8,
              padding: '6px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent'
            }}
            className="hover-bg-danger"
            title="Delete Watch Log"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default HistoryLogItem;

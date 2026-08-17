import React from 'react';
import { Users, X } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useModal } from '../../../context/ModalContext';

const HistoryShareModal = () => {
  const { showAlert } = useModal();
  const { 
    isShareModalOpen, closeShareModal, selectedLogIds, shareableUsers, 
    selectedTargetUserIds, toggleTargetUser, submitShare, isSubmittingShare 
  } = useHistoryStore();

  if (!isShareModalOpen) return null;

  const handleShareSubmit = async () => {
    try {
      await submitShare();
      showAlert('Successfully updated watch history sharing!', 'success');
    } catch (err) {
      console.error('Failed to execute watch history share action:', err);
      showAlert('Failed to update shared watch history.', 'error');
    }
  };

  return (
    <div className="custom-modal-backdrop" onClick={closeShareModal}>
      <div className="custom-modal-content" style={{ maxWidth: '520px', width: '90vw' }} onClick={e => e.stopPropagation()}>
        <div className="custom-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Watched Together</h3>
          </div>
          <button onClick={closeShareModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="custom-modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Apply watch history updates for <strong>{selectedLogIds.length} item{selectedLogIds.length > 1 ? 's' : ''}</strong>:
          </p>

          {/* Target User List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            {shareableUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No other user accounts found to share with.
              </div>
            ) : (
              shareableUsers.map(u => {
                const isChecked = selectedTargetUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--overlay-subtle)',
                      border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden' }}>
                        {u.avatarPath ? (
                          <img src={u.avatarPath} alt={u.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                        ) : null}
                        <span style={{ display: u.avatarPath ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.92rem' }}>
                          {u.name || u.username}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          @{u.username}
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTargetUser(u.id)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="custom-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px' }}>
          <button
            type="button"
            onClick={closeShareModal}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShareSubmit}
            disabled={isSubmittingShare}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.88rem', background: 'var(--accent)' }}
          >
            {isSubmittingShare ? 'Updating...' : 'Update / Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryShareModal;

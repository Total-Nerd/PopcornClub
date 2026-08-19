import React from 'react';
import { Users, Trash2, X } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useModal } from '../../../context/ModalContext';

const HistoryBulkActions = () => {
  const { selectedLogIds, clearLogSelection, openShareModal, bulkDeleteLogs } = useHistoryStore();
  const { showConfirm, showAlert } = useModal();

  if (selectedLogIds.length === 0) return null;

  const handleBulkDelete = async () => {
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedLogIds.length} selected watch history entry(ies)?`);
    if (!confirmed) return;
    try {
      await bulkDeleteLogs();
      showAlert(`Successfully deleted ${selectedLogIds.length} watch history entry(ies).`, 'success');
    } catch (err) {
      console.error('Failed bulk delete:', err);
      showAlert('Failed to delete selected watch history entries.', 'error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      background: 'rgba(20, 24, 33, 0.94)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '16px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)'
    }}>
      <span style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-main)' }}>
        {selectedLogIds.length} item{selectedLogIds.length > 1 ? 's' : ''} selected
      </span>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => openShareModal(selectedLogIds)}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Users size={16} />
          Watched Together
        </button>

        <button
          onClick={handleBulkDelete}
          className="btn btn-danger"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--danger)' }}
        >
          <Trash2 size={16} />
          Delete Selected
        </button>

        <button
          onClick={clearLogSelection}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}
          title="Deselect All"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default HistoryBulkActions;

import React, { useState } from 'react';
import { createRequest } from '../api/requests';
import { useModal } from '../context/ModalContext';
import { ListPlus, Loader, CheckCircle, X } from 'lucide-react';

const RequestButton = ({ tmdbId, type, title, season = null, episode = null, initialRequested = false, className = '', style = {} }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialRequested ? 'requested' : null); // 'requested', 'rejected', etc.
  const [autoRejectInfo, setAutoRejectInfo] = useState(null);
  const { showAlert } = useModal();

  const handleRequest = async () => {
    setLoading(true);
    try {
      await createRequest({ tmdbId, type, title, season, episode });
      setStatus('requested');
      // Use the standard toast for success
      showAlert('Your request has been submitted.', 'success');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        if (error.response.data.error.includes('already requested')) {
           setStatus('requested');
        } else if (error.response.data.error.includes('automatically rejected')) {
           setAutoRejectInfo({
             error: error.response.data.error,
             reason: error.response.data.reason
           });
        } else {
           showAlert(error.response.data.error, 'error');
        }
      } else {
        showAlert('Failed to submit request.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {status === 'requested' ? (
        <button 
          disabled 
          className={`btn btn-secondary ${className}`}
          style={{ 
            background: 'var(--warning-bg)', 
            color: 'var(--warning-color)', 
            border: '1px solid var(--warning-border)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'default',
            opacity: 0.8,
            ...style
          }}
        >
          <CheckCircle size={18} />
          Requested
        </button>
      ) : (
        <button 
          onClick={handleRequest} 
          disabled={loading}
          className={`btn btn-secondary ${className}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}
          title="Request to be added to Plex"
        >
          {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ListPlus size={18} />}
          Request
        </button>
      )}

      {/* Auto-Reject Modal */}
      {autoRejectInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }} onClick={(e) => { e.stopPropagation(); setAutoRejectInfo(null); }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', background: 'var(--panel-bg)', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger)' }}>Request Rejected</h3>
              <button onClick={() => setAutoRejectInfo(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {autoRejectInfo.error}
            </p>
            
            {autoRejectInfo.reason && (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Reason:</span>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '4px' }}>
                  {autoRejectInfo.reason}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                onClick={() => setAutoRejectInfo(null)}
                className="btn btn-primary"
                style={{ padding: '8px 16px' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RequestButton;

import React from 'react';
import { History } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import HistoryLogItem from './HistoryLogItem';

const HistoryLogsList = () => {
  const { logs, loading, selectedLogIds, selectAllLogs, clearLogSelection } = useHistoryStore();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeft: '4px solid var(--accent)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <History size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
        <p>No watch history matches found.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={logs.length > 0 && selectedLogIds.length === logs.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAllLogs();
                  } else {
                    clearLogSelection();
                  }
                }}
                style={{ cursor: 'pointer', transform: 'scale(1.15)', accentColor: 'var(--accent)' }}
                title="Select All On Page"
              />
            </th>
            <th>Media Info</th>
            <th>Type</th>
            <th>Watch Date & Time</th>
            <th>Duration / Progress</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <HistoryLogItem key={log.id} log={log} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryLogsList;

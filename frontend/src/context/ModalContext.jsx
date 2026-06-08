import React, { createContext, useState, useContext, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]); // { id, message, type }
  const [confirm, setConfirm] = useState(null); // { message, onConfirm, onCancel }

  // Add alert (toast)
  const showAlert = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setAlerts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        dismissAlert(id);
      }, duration);
    }
  };

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  // Show confirm modal
  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirm({
        message,
        onConfirm: () => {
          setConfirm(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirm(null);
          resolve(false);
        }
      });
    });
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Global Toast Alerts */}
      <div className="toast-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`toast-item toast-${alert.type}`}>
            <span className="toast-icon">
              {alert.type === 'success' && <CheckCircle size={18} />}
              {alert.type === 'error' && <AlertTriangle size={18} />}
              {alert.type === 'info' && <Info size={18} />}
            </span>
            <div className="toast-message">{alert.message}</div>
            <button className="toast-close-btn" onClick={() => dismissAlert(alert.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Global Confirm Modal */}
      {confirm && (
        <div className="confirm-modal-backdrop" onClick={confirm.onCancel}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-body">
              <AlertTriangle size={36} className="confirm-modal-icon" />
              <div className="confirm-modal-message">{confirm.message}</div>
            </div>
            <div className="confirm-modal-footer">
              <button className="btn btn-secondary confirm-btn-cancel" onClick={confirm.onCancel}>
                Cancel
              </button>
              <button className="btn btn-primary confirm-btn-confirm" onClick={confirm.onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

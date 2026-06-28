import React from 'react';

export default function Toast({ toasts, onClose }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type || 'info'} ${toast.isExiting ? 'toast--exit' : ''}`}
        >
          <span className="toast__icon">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span className="toast__message">{toast.message}</span>
          <button className="toast__close" onClick={() => onClose(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

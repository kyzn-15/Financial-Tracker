import AppIcon from './AppIcon';

export default function Toast({ toasts, onClose }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type || 'info'} ${toast.isExiting ? 'toast--exit' : ''}`}
        >
          <span className="toast__icon">
            <AppIcon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'circle-x' : 'info'} />
          </span>
          <span className="toast__message">{toast.message}</span>
          <button className="toast__close" onClick={() => onClose(toast.id)}>
            <AppIcon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

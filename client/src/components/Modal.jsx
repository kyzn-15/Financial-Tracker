import React from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content__header">
          <h2 className="modal-content__title">{title}</h2>
          <button className="modal-content__close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        <div className="modal-content__body">
          {children}
        </div>
      </div>
    </div>
  );
}

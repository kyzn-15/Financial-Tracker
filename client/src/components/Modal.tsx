import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showClose?: boolean;
  dismissOnOverlayClick?: boolean;
  contentClassName?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  showClose = true,
  dismissOnOverlayClick = true,
  contentClassName = '',
}: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={dismissOnOverlayClick ? onClose : undefined}>
      <div className={`modal-content ${contentClassName}`.trim()} onClick={(event) => event.stopPropagation()}>
        <div className="modal-content__header">
          <h2 className="modal-content__title">{title}</h2>
          {showClose && (
            <button className="modal-content__close" type="button" onClick={onClose} aria-label="Close modal">
              <AppIcon name="x" />
            </button>
          )}
        </div>
        <div className="modal-content__body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

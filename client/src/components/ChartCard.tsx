import { useEffect, useState, type ReactNode } from 'react';
import AppIcon from './AppIcon';
import Modal from './Modal';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  headerAside?: ReactNode;
  children: (expanded: boolean) => ReactNode;
}

export default function ChartCard({ title, subtitle, className = '', headerAside, children }: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  return (
    <article className={`chart-card ${className}`.trim()}>
      <div className="chart-card__header">
        <div className="chart-card__heading">
          <h3 className="chart-card__title">{title}</h3>
          {subtitle ? <p className="chart-card__subtitle">{subtitle}</p> : null}
        </div>
        {headerAside ? <div className="chart-card__aside">{headerAside}</div> : null}
      </div>
      <button
        className="chart-card__expand"
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Expand ${title}`}
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        <AppIcon name="expand" size={16} />
      </button>
      {children(false)}
      <Modal
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        title={title}
        contentClassName="modal-content--chart"
      >
        <div className="chart-popup">
          {subtitle ? <p className="chart-popup__subtitle">{subtitle}</p> : null}
          {children(true)}
        </div>
      </Modal>
    </article>
  );
}

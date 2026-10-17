import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import Modal from './Modal';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

interface OptionSelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dialogTitle: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export default function OptionSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select',
  dialogTitle,
  disabled = false,
  ariaLabel,
  className = '',
}: OptionSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const closePicker = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const selected = options.find((option) => option.value === value);
  const triggerLabel = selected?.label || placeholder;
  const canOpen = !disabled && options.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closePicker();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closePicker]);

  const handlePick = (nextValue: string) => {
    if (nextValue !== value) onChange(nextValue);
    closePicker();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`neo-select category-select__trigger${selected ? '' : ' category-select__trigger--placeholder'}${className ? ` ${className}` : ''}`}
        disabled={!canOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || dialogTitle}
        onClick={() => setOpen(true)}
      >
        {selected?.icon && <AppIcon name={selected.icon} size={16} />}
        <span className="category-select__trigger-label">{triggerLabel}</span>
      </button>
      <Modal isOpen={open} onClose={closePicker} title={dialogTitle}>
        <div className="folder-picker__list category-picker__list" role="listbox" aria-label={dialogTitle}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value === '' ? `empty-${index}` : option.value}
                type="button"
                className={`folder-picker__option${isSelected ? ' folder-picker__option--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                autoFocus={isSelected || (!selected && index === 0)}
                onClick={() => handlePick(option.value)}
              >
                {option.icon && <AppIcon name={option.icon} size={16} />}
                <span className="category-picker__name">{option.label}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

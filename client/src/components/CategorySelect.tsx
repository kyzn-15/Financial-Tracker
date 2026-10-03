import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import Modal from './Modal';
import { getCategoryIconName } from '../utils/categoryIcons';

export interface CategoryChoice {
  name: string;
  usageCount?: number;
}

interface CategorySelectProps {
  id?: string;
  choices: CategoryChoice[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  dialogTitle?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onOpen?: () => void | Promise<unknown>;
}

interface PickerOption {
  key: string;
  value: string;
  label: string;
  icon: string;
  usageCount?: number;
}

function usageLabel(count: number): string {
  return `${count} ${count === 1 ? 'expense' : 'expenses'}`;
}

export default function CategorySelect({
  id,
  choices,
  value,
  onChange,
  placeholder = 'Select category',
  emptyLabel,
  dialogTitle = 'Choose category',
  disabled = false,
  ariaLabel = 'Category',
  onOpen,
}: CategorySelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const closePicker = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const options: PickerOption[] = [
    ...(emptyLabel ? [{ key: 'all', value: '', label: emptyLabel, icon: 'clipboard' }] : []),
    ...choices.map((choice) => ({
      key: choice.name,
      value: choice.name,
      label: choice.name,
      icon: getCategoryIconName(choice.name),
      usageCount: choice.usageCount,
    })),
  ];
  const selected = options.find((option) => option.value === value);
  const hasSelectedOption = selected != null;
  const isPlaceholder = !selected && value === '';
  const triggerLabel = selected?.label || value || placeholder;
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
        className={`neo-select category-select__trigger${isPlaceholder ? ' category-select__trigger--placeholder' : ''}`}
        disabled={!canOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen(true);
          void Promise.resolve(onOpen?.()).catch(() => {});
        }}
      >
        {selected && selected.value !== '' && <AppIcon name={selected.icon} size={16} />}
        <span className="category-select__trigger-label">{triggerLabel}</span>
      </button>
      <Modal isOpen={open} onClose={closePicker} title={dialogTitle}>
        <div className="folder-picker__list category-picker__list" role="listbox" aria-label={dialogTitle}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const focusOption = isSelected || (!hasSelectedOption && index === 0);
            return (
              <button
                key={option.key}
                type="button"
                className={`folder-picker__option${isSelected ? ' folder-picker__option--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                autoFocus={focusOption}
                onClick={() => handlePick(option.value)}
              >
                <AppIcon name={option.icon} size={16} />
                <span className="category-picker__name">{option.label}</span>
                {option.usageCount != null && (
                  <span className="category-picker__count">{usageLabel(option.usageCount)}</span>
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

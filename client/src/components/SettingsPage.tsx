import { useEffect, useRef, useState } from 'react';
import BackupSettings from './BackupSettings';
import CategoryManager from './CategoryManager';
import { EmergencySettingsPanel } from './EmergencyFundDashboard';
import AppIcon from './AppIcon';
import RecycleBinManager from './RecycleBinManager';
import RecurringPaymentsManager from './RecurringPaymentsManager';
import Modal from './Modal';
import type {
  BackupPreferences,
  Category,
  CategoryStore,
  Currency,
  EmergencyFundStore,
  ExchangeRate,
  RecurrenceFrequency,
  RecurringExpenseStore,
  RecycleBinStore,
  ResetIntent,
  Theme,
} from '../types';
import { getErrorMessage } from '../utils/errors';

interface SettingsPageProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  categoryStore: CategoryStore;
  onAddCategory: (name: string) => Promise<Category[]>;
  onRenameCategory: (id: number, name: string) => Promise<Category[]>;
  onRemoveCategory: (id: number) => Promise<Category[]>;
  onReorderCategories: (ids: number[]) => Promise<Category[]>;
  backupPreferences: BackupPreferences | null;
  onSaveBackupInterval: (intervalDays: number) => Promise<BackupPreferences>;
  onResetLastBackup: () => Promise<BackupPreferences>;
  isSavingBackupPreferences: boolean;
  emergency: EmergencyFundStore;
  currency: Currency;
  exchangeRate: ExchangeRate | null;
  recurringStore: RecurringExpenseStore;
  recycleBin: RecycleBinStore;
  onUpdateCategoryAutomation: (id: number, enabled: boolean, frequency: RecurrenceFrequency) => Promise<Category[]>;
  onCreateResetIntent: () => Promise<ResetIntent>;
  onResetApp: (resetToken: string, pin: string) => Promise<void>;
  onNotify: (message: string, type?: 'info' | 'success' | 'error') => void;
}

interface SettingsSection {
  id: 'appearance' | 'categories' | 'recurring' | 'emergency' | 'backup' | 'recycle-bin' | 'security';
  name: string;
  icon: string;
  accent: 'violet' | 'blue' | 'cyan' | 'green' | 'amber' | 'danger';
  description: string;
}

interface SettingsGroup {
  id: string;
  title: string;
  sections: SettingsSection[];
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'personalization',
    title: 'Personalization',
    sections: [
      {
        id: 'appearance',
        name: 'Appearance',
        icon: 'palette',
        accent: 'violet',
        description: 'Switch between light and dark themes across FinTracker.',
      },
    ],
  },
  {
    id: 'expense-management',
    title: 'Expense management',
    sections: [
      {
        id: 'categories',
        name: 'Expense Categories',
        icon: 'sliders-horizontal',
        accent: 'blue',
        description: 'Add, rename, reorder, and automate expense categories.',
      },
      {
        id: 'recurring',
        name: 'Recurring Payments',
        icon: 'refresh',
        accent: 'cyan',
        description: 'Review, pause, edit, or cancel automated recurring expenses.',
      },
      {
        id: 'emergency',
        name: 'Emergency Fund',
        icon: 'piggy-bank',
        accent: 'green',
        description: 'Configure savings, reserved funds, targets, and essential categories.',
      },
    ],
  },
  {
    id: 'data-security',
    title: 'Data & security',
    sections: [
      {
        id: 'backup',
        name: 'Backup & Export',
        icon: 'database',
        accent: 'violet',
        description: 'Set backup reminders and track your most recent export.',
      },
      {
        id: 'recycle-bin',
        name: 'Recycle Bin',
        icon: 'trash',
        accent: 'amber',
        description: 'Restore or permanently remove deleted expenses and receipts within 7 days.',
      },
      {
        id: 'security',
        name: 'Security & Reset',
        icon: 'shield-check',
        accent: 'danger',
        description: 'Permanently erase all app data behind PIN confirmation.',
      },
    ],
  },
];

const ALL_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.sections);

export default function SettingsPage({
  theme,
  onThemeChange,
  categoryStore,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
  onReorderCategories,
  backupPreferences,
  onSaveBackupInterval,
  onResetLastBackup,
  isSavingBackupPreferences,
  emergency,
  currency,
  exchangeRate,
  recurringStore,
  recycleBin,
  onUpdateCategoryAutomation,
  onCreateResetIntent,
  onResetApp,
  onNotify,
}: SettingsPageProps) {
  const isDark = theme === 'dark';
  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  type SettingsSectionId = SettingsSection['id'];
const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(10);
  const [resetIntent, setResetIntent] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [isPreparingReset, setIsPreparingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const overviewHeadingRef = useRef<HTMLElement>(null);
  const breadcrumbRef = useRef<HTMLElement>(null);
  const hasNavigatedRef = useRef(false);

  const activeSection = ALL_SECTIONS.find((section) => section.id === activeSectionId) || null;

  useEffect(() => {
    if (!hasNavigatedRef.current) return undefined;
    document.querySelector('.main-content')?.scrollTo(0, 0);
    if (activeSection) breadcrumbRef.current?.focus();
    else overviewHeadingRef.current?.focus();
    return undefined;
  }, [activeSection]);

  useEffect(() => {
    if (!isResetOpen || resetCountdown === 0) return undefined;
    const timeoutId = window.setTimeout(() => setResetCountdown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [isResetOpen, resetCountdown]);

  const openSection = (sectionId: SettingsSectionId | null) => {
    hasNavigatedRef.current = true;
    setActiveSectionId(sectionId);
  };

  const openResetDialog = async () => {
    setResetCountdown(10);
    setResetIntent('');
    setResetPin('');
    setResetError('');
    setIsResetOpen(true);
    setIsPreparingReset(true);
    try {
      const intent = await onCreateResetIntent();
      setResetIntent(intent.token);
      setResetCountdown(intent.waitSeconds);
    } catch (error) {
      setResetError(getErrorMessage(error, 'Could not prepare the secure reset.'));
    } finally {
      setIsPreparingReset(false);
    }
  };

  const closeResetDialog = () => {
    if (!isResetting) {
      setIsResetOpen(false);
      setResetIntent('');
      setResetPin('');
    }
  };

  const confirmReset = async () => {
    if (resetCountdown > 0 || isResetting || !resetIntent || !/^\d{4,12}$/.test(resetPin)) return;
    setIsResetting(true);
    setResetError('');
    try {
      await onResetApp(resetIntent, resetPin);
    } catch (error) {
      setResetError(getErrorMessage(error, 'Could not reset the application.'));
      setIsResetting(false);
    }
  };

  const renderOverview = () => (
    <>
      <header className="settings-header" ref={overviewHeadingRef} tabIndex={-1}>
        <p className="dashboard-section__eyebrow">Personal manager</p>
        <h2>Settings</h2>
        <p className="dashboard-section__description">
          Choose a category to configure how FinTracker looks, automates, and protects your data.
        </p>
      </header>
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.id} className="settings-group" aria-labelledby={`settings-group-${group.id}`}>
          <h3 className="settings-group__title" id={`settings-group-${group.id}`}>{group.title}</h3>
          <div className="settings-group__list clay-card">
            {group.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-category settings-category--${section.accent}`}
                onClick={() => openSection(section.id)}
              >
                <span className="settings-category__icon">
                  <AppIcon name={section.icon} size={20} />
                </span>
                <span className="settings-category__content">
                  <strong>{section.name}</strong>
                  <span>{section.description}</span>
                </span>
                <AppIcon className="settings-category__chevron" name="chevron-right" size={18} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );

  const renderBreadcrumb = (section: SettingsSection) => (
    <nav ref={breadcrumbRef} className="settings-breadcrumb" aria-label="Breadcrumb" tabIndex={-1}>
      <button type="button" className="settings-breadcrumb__link" onClick={() => openSection(null)}>
        <AppIcon name="arrow-left" size={14} />
        Settings
      </button>
      <AppIcon className="settings-breadcrumb__separator" name="chevron-right" size={14} />
      <span className="settings-breadcrumb__current" aria-current="page">{section.name}</span>
    </nav>
  );

  const renderSection = (section: SettingsSection) => {
    switch (section.id) {
      case 'appearance':
        return (
          <section className="theme-settings clay-card clay-card--violet" aria-labelledby="appearance-settings-title">
            <div className="settings-section-heading">
              <div>
                <h3 id="appearance-settings-title">Theme</h3>
                <p>Choose the theme used throughout FinTracker.</p>
              </div>
              <button
                className={`theme-toggle ${isDark ? 'theme-toggle--active' : ''}`}
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label="Use dark mode"
                onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
              >
                <span className="theme-toggle__icon"><AppIcon name="sun" size={16} /></span>
                <span className="theme-toggle__track" aria-hidden="true">
                  <span className="theme-toggle__thumb" />
                </span>
                <span className="theme-toggle__icon"><AppIcon name="moon" size={16} /></span>
                <span className="theme-toggle__label">{isDark ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </section>
        );
      case 'categories':
        return (
          <CategoryManager
            categories={categoryStore.categories}
            loading={categoryStore.loading}
            error={categoryStore.error}
            onRetry={categoryStore.refresh}
            onAdd={onAddCategory}
            onRename={onRenameCategory}
            onRemove={onRemoveCategory}
            onReorder={onReorderCategories}
            onUpdateAutomation={onUpdateCategoryAutomation}
          />
        );
      case 'recurring':
        return <RecurringPaymentsManager store={recurringStore} categories={categoryStore.categories} />;
      case 'backup':
        return (
          <BackupSettings
            preferences={backupPreferences}
            onSaveInterval={onSaveBackupInterval}
            onResetLastBackup={onResetLastBackup}
            isSaving={isSavingBackupPreferences}
          />
        );
      case 'recycle-bin':
        return (
          <RecycleBinManager
            store={recycleBin}
            currency={currency}
            exchangeRate={exchangeRate}
            onNotify={onNotify}
          />
        );
      case 'emergency':
        return !emergency.settingsPayload ? (
          <div className={`settings-page__status clay-card ${emergency.error ? 'settings-page__status--error' : ''}`}>
            {emergency.error
              ? `Could not load emergency fund settings: ${emergency.error}`
              : 'Loading emergency fund settings...'}
          </div>
        ) : (
          <EmergencySettingsPanel
            settingsPayload={emergency.settingsPayload}
            onSave={emergency.saveSettings}
            saving={emergency.saving}
            currency={currency}
            myrToIdr={myrToIdr}
          />
        );
      case 'security':
        return (
          <>
            <section className="reset-settings clay-card" aria-labelledby="reset-settings-title">
              <div className="settings-section-heading">
                <div>
                  <h3 id="reset-settings-title">Danger zone</h3>
                  <p>Permanently delete every saved record and restart with a clean app.</p>
                </div>
                <button className="clay-btn clay-btn--danger" type="button" onClick={openResetDialog}>
                  Reset app
                </button>
              </div>
            </section>
            <Modal
              isOpen={isResetOpen}
              onClose={closeResetDialog}
              title="Permanently reset the app?"
              dismissOnOverlayClick={!isResetting}
            >
              <div className="confirm-dialog reset-confirmation">
                <p className="confirm-dialog__text">
                  This permanently deletes all expenses, receipt images, custom categories, recurring payments,
                  emergency fund settings, and backup preferences.
                </p>
                <p className="reset-confirmation__warning">
                  Unlike normal deletion, nothing removed here goes to the Recycle Bin. This process is irreversible.
                  Export a database backup first if you may need this data again.
                </p>
                <div className="reset-confirmation__pin-field">
                  <label className="clay-label" htmlFor="reset-pin">Current PIN</label>
                  <input
                    id="reset-pin"
                    className="clay-input reset-confirmation__pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={12}
                    value={resetPin}
                    onChange={(event) => setResetPin(event.target.value)}
                    disabled={isResetting}
                    aria-describedby={resetError ? 'reset-error' : undefined}
                  />
                </div>
                {resetError && <p id="reset-error" className="reset-confirmation__error">{resetError}</p>}
                <div className="confirm-dialog__actions">
                  <button
                    className="clay-btn clay-btn--secondary"
                    type="button"
                    onClick={closeResetDialog}
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    className="clay-btn clay-btn--danger"
                    type="button"
                    onClick={confirmReset}
                    disabled={
                      resetCountdown > 0 ||
                      isPreparingReset ||
                      isResetting ||
                      !resetIntent ||
                      !/^\d{4,12}$/.test(resetPin)
                    }
                  >
                    {isResetting
                      ? 'Resetting...'
                      : isPreparingReset ? 'Preparing secure reset...'
                      : resetCountdown > 0 ? `Confirm reset (${resetCountdown}s)` : 'Confirm permanent reset'}
                  </button>
                </div>
              </div>
            </Modal>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      {!activeSection ? renderOverview() : (
        <>
          {renderBreadcrumb(activeSection)}
          {renderSection(activeSection)}
        </>
      )}
    </div>
  );
}

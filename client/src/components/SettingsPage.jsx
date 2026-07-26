import { useEffect, useState } from 'react';
import BackupSettings from './BackupSettings';
import CategoryManager from './CategoryManager';
import { EmergencySettingsPanel } from './EmergencyFundDashboard';
import AppIcon from './AppIcon';
import RecurringPaymentsManager from './RecurringPaymentsManager';
import Modal from './Modal';

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
  onUpdateCategoryAutomation,
  onCreateResetIntent,
  onResetApp,
}) {
  const isDark = theme === 'dark';
  const myrToIdr = exchangeRate?.myrToIdr || 4500;
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(10);
  const [resetIntent, setResetIntent] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [isPreparingReset, setIsPreparingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    if (!isResetOpen || resetCountdown === 0) return undefined;
    const timeoutId = window.setTimeout(() => setResetCountdown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [isResetOpen, resetCountdown]);

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
      setResetError(error.message || 'Could not prepare the secure reset.');
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
      setResetError(error.message || 'Could not reset the application.');
      setIsResetting(false);
    }
  };

  return (
    <div className="settings-page">
      <section className="theme-settings neo-card" aria-labelledby="appearance-settings-title">
        <div className="settings-section-heading">
          <div>
            <h3 id="appearance-settings-title">Appearance</h3>
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

      <RecurringPaymentsManager store={recurringStore} categories={categoryStore.categories} />

      <BackupSettings
        preferences={backupPreferences}
        onSaveInterval={onSaveBackupInterval}
        onResetLastBackup={onResetLastBackup}
        isSaving={isSavingBackupPreferences}
      />

      {!emergency.settingsPayload ? (
        <div className={`settings-page__status neo-card ${emergency.error ? 'settings-page__status--error' : ''}`}>
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
      )}

      <section className="reset-settings neo-card" aria-labelledby="reset-settings-title">
        <div className="settings-section-heading">
          <div>
            <h3 id="reset-settings-title">Danger zone</h3>
            <p>Permanently delete every saved record and restart with a clean app.</p>
          </div>
          <button className="neo-btn neo-btn--danger" type="button" onClick={openResetDialog}>
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
            This process is irreversible. Export a database backup first if you may need this data again.
          </p>
          <div className="reset-confirmation__pin-field">
            <label className="neo-label" htmlFor="reset-pin">Current PIN</label>
            <input
              id="reset-pin"
              className="neo-input reset-confirmation__pin"
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
              className="neo-btn neo-btn--secondary"
              type="button"
              onClick={closeResetDialog}
              disabled={isResetting}
            >
              Cancel
            </button>
            <button
              className="neo-btn neo-btn--danger"
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
    </div>
  );
}

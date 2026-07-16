import React from 'react';
import BackupSettings from './BackupSettings';
import CategoryManager from './CategoryManager';
import { EmergencySettingsPanel } from './EmergencyFundDashboard';
import AppIcon from './AppIcon';

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
}) {
  const isDark = theme === 'dark';
  const myrToIdr = exchangeRate?.myrToIdr || 4500;

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
      />

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
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BackupPreferences } from '../types';
import { getErrorMessage } from '../utils/errors';

const REMINDER_OPTIONS = [
  { value: 30, label: 'Every 30 days' },
  { value: 14, label: 'Every 2 weeks' },
  { value: 1, label: 'Every day' },
];

function formatBackupDate(value: string | null): string {
  if (!value) return 'No backup recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No backup recorded';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Singapore',
  });
}

interface BackupSettingsProps {
  preferences: BackupPreferences | null;
  onSaveInterval: (intervalDays: number) => Promise<BackupPreferences>;
  onResetLastBackup: () => Promise<BackupPreferences>;
  isSaving: boolean;
}

export default function BackupSettings({ preferences, onSaveInterval, onResetLastBackup, isSaving }: BackupSettingsProps) {
  const [selectedInterval, setSelectedInterval] = useState(preferences?.reminder_interval_days ?? 30);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (preferences) setSelectedInterval(preferences.reminder_interval_days);
  }, [preferences]);

  if (!preferences) return <div className="backup-settings neo-card">Loading backup settings...</div>;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onSaveInterval(Number(selectedInterval));
      setMessage('Backup reminder updated.');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not update backup reminder.'));
    }
  };

  const handleReset = async () => {
    try {
      await onResetLastBackup();
      setMessage('Last backup date cleared. You will be reminded next session.');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Could not reset backup date.'));
    }
  };

  return (
    <section className="backup-settings neo-card" aria-labelledby="backup-settings-title">
      <div className="backup-settings__heading">
        <p className="login-kicker">Data protection</p>
        <h3 id="backup-settings-title">Database backup reminder</h3>
        <p>Export a complete XLSX database backup regularly and keep it somewhere safe.</p>
      </div>

      <div className="backup-settings__last-backup">
        <span>Last backup</span>
        <strong>{formatBackupDate(preferences.last_backup_at)}</strong>
      </div>

      <form className="backup-settings__form" onSubmit={handleSubmit}>
        <label className="neo-label" htmlFor="backup-reminder-interval">Remind me</label>
        <select
          id="backup-reminder-interval"
          className="neo-select"
          value={selectedInterval}
          onChange={(event) => setSelectedInterval(Number(event.target.value))}
          disabled={isSaving}
        >
          {REMINDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="backup-settings__actions">
          <button className="neo-btn neo-btn--primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save reminder'}
          </button>
          <button className="neo-btn neo-btn--danger" type="button" onClick={handleReset} disabled={isSaving || !preferences.last_backup_at}>
            Clear last backup date
          </button>
        </div>
        {message && <p className="backup-settings__message">{message}</p>}
      </form>
    </section>
  );
}

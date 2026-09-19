import AppIcon from './AppIcon';
import type { Theme } from '../types';

interface AppearanceSettingsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export default function AppearanceSettings({ theme, onThemeChange }: AppearanceSettingsProps) {
  const isDark = theme === 'dark';

  return (
    <section className="appearance-settings neo-card" aria-labelledby="appearance-settings-title">
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
          <span className="theme-toggle__track" aria-hidden="true"><span className="theme-toggle__thumb" /></span>
          <span className="theme-toggle__icon"><AppIcon name="moon" size={16} /></span>
          <span className="theme-toggle__label">{isDark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </section>
  );
}

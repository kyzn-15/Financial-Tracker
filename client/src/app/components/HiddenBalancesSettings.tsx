import { usePrivacyMode } from '../hooks/usePrivacyMode';
import type { PrivacyOnLoginPreference } from '../types';

const PRIVACY_ON_LOGIN_OPTIONS: Array<{
  value: PrivacyOnLoginPreference;
  label: string;
  description: string;
}> = [
  {
    value: 'always-on',
    label: 'Always hide balances',
    description: 'Privacy mode turns on every time you sign in or start a new session.',
  },
  {
    value: 'always-off',
    label: 'Always show balances',
    description: 'Privacy mode stays off every time you sign in or start a new session.',
  },
  {
    value: 'remember',
    label: 'Remember last session',
    description: 'Use the last hidden-balances setting from your previous session. Default.',
  },
];

export default function HiddenBalancesSettings() {
  const { privacyOnLogin, setPrivacyOnLogin } = usePrivacyMode();

  return (
    <section className="privacy-settings neo-card" aria-labelledby="privacy-login-settings-title">
      <div className="settings-section-heading">
        <div>
          <h3 id="privacy-login-settings-title">Hidden balances</h3>
          <p>Choose how privacy mode starts when you sign in or open a new session. You can still toggle it during the session.</p>
        </div>
      </div>
      <div className="privacy-login-options" role="radiogroup" aria-labelledby="privacy-login-settings-title">
        {PRIVACY_ON_LOGIN_OPTIONS.map((option) => {
          const isSelected = privacyOnLogin === option.value;
          return (
            <label
              key={option.value}
              className={`privacy-login-option${isSelected ? ' privacy-login-option--selected' : ''}`}
            >
              <input
                type="radio"
                name="privacy-on-login"
                value={option.value}
                checked={isSelected}
                onChange={() => setPrivacyOnLogin(option.value)}
              />
              <span className="privacy-login-option__copy">
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

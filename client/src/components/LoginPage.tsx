import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { getSystemStatus } from '../services/api';
import type { LoginCredentials } from '../types';
import { getErrorMessage } from '../utils/errors';
import appLogo from '../assets/logo.svg';

interface LoginPageProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onRegister: (credentials: LoginCredentials) => Promise<void>;
}

type LoginStep = 'username' | 'pin';
type SystemStatus = 'checking' | 'operational' | 'issues';

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<LoginStep>('username');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('checking');
  const pinInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'pin') {
      pinInputRef.current?.focus();
    } else {
      usernameInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    let isActive = true;

    const checkSystemStatus = async () => {
      try {
        const { status } = await getSystemStatus();
        if (isActive) setSystemStatus(status === 'ok' ? 'operational' : 'issues');
      } catch {
        if (isActive) setSystemStatus('issues');
      }
    };

    checkSystemStatus();
    const intervalId = window.setInterval(checkSystemStatus, 30000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleUsernameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setError('Enter your username.');
      return;
    }

    setError('');
    setStep('pin');
  };

  const handlePinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pin.length !== 6) {
      setError('Enter your 6-digit PIN.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onLogin({ username: username.trim(), pin });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid username or PIN.'));
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPin = event.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(nextPin);
    if (error) setError('');
  };

  const handleBack = () => {
    setStep('username');
    setPin('');
    setError('');
  };

  const showRegister = () => {
    setMode('register');
    setStep('username');
    setPin('');
    setConfirmPin('');
    setError('');
  };

  const showLogin = () => {
    setMode('login');
    setStep('username');
    setPin('');
    setConfirmPin('');
    setError('');
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setError('Enter a username.');
      return;
    }
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setError('Enter and confirm a 6-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onRegister({ username: normalizedUsername, pin });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">
          <img src={appLogo} alt="" className="brand-logo" />
        </div>

        <div className="login-copy">
          <h1 id="login-title" className="login-title">
            Financial Tracker
          </h1>
          <p className="login-subtitle">
            {mode === 'register'
              ? 'Create a username and a 6-digit PIN.'
              : step === 'username'
                ? 'Enter your username to continue.'
                : 'Enter your 6-digit PIN.'}
          </p>
        </div>

        {systemStatus === 'issues' && (
          <div className="system-status system-status--issues" role="status" aria-live="polite">
            <span className="system-status__icon" aria-hidden="true" />
            <span>System issues detected</span>
          </div>
        )}
        {mode === 'register' ? (
          <form className="login-form" onSubmit={handleRegisterSubmit}>
            <label className="neo-label" htmlFor="register-username">Username</label>
            <input
              id="register-username"
              className="neo-input login-input"
              type="text"
              value={username}
              autoComplete="username"
              spellCheck="false"
              maxLength={80}
              disabled={isSubmitting}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError('');
              }}
            />
            <label className="neo-label" htmlFor="register-pin">PIN</label>
            <input
              id="register-pin"
              className="neo-input login-input login-input--pin"
              type="password"
              value={pin}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="new-password"
              disabled={isSubmitting}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, '').slice(0, 6));
                if (error) setError('');
              }}
            />
            <label className="neo-label" htmlFor="register-confirm-pin">Confirm PIN</label>
            <input
              id="register-confirm-pin"
              className="neo-input login-input login-input--pin"
              type="password"
              value={confirmPin}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="new-password"
              disabled={isSubmitting}
              onChange={(event) => {
                setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6));
                if (error) setError('');
              }}
            />
            {error && <p className="login-error">{error}</p>}
            <button
              className="neo-btn neo-btn--primary neo-btn--full"
              type="submit"
              disabled={isSubmitting || pin.length !== 6 || confirmPin.length !== 6}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
            <button className="neo-btn neo-btn--secondary neo-btn--full" type="button" onClick={showLogin} disabled={isSubmitting}>
              Back to sign in
            </button>
          </form>
        ) : step === 'username' ? (
          <form className="login-form" onSubmit={handleUsernameSubmit}>
            <label className="neo-label" htmlFor="login-username">
              Username
            </label>
            <input
              ref={usernameInputRef}
              id="login-username"
              className="neo-input login-input"
              type="text"
              value={username}
              autoComplete="username"
              spellCheck="false"
              disabled={isSubmitting}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError('');
              }}
            />

            {error && <p className="login-error">{error}</p>}

            <button className="neo-btn neo-btn--primary neo-btn--full" type="submit">
              Continue
            </button>
            <button className="neo-btn neo-btn--secondary neo-btn--full" type="button" onClick={showRegister}>
              Create an account
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handlePinSubmit}>
            <label className="neo-label" htmlFor="login-pin">
              PIN
            </label>
            <input
              ref={pinInputRef}
              id="login-pin"
              className="neo-input login-input login-input--pin"
              type="password"
              value={pin}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="current-password"
              disabled={isSubmitting}
              onChange={handlePinChange}
            />

            <div className="pin-dots" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  className={`pin-dot${pin.length > index ? ' pin-dot--filled' : ''}`}
                  key={index}
                />
              ))}
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="login-actions">
              <button
                className="neo-btn neo-btn--secondary"
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button className="neo-btn neo-btn--primary" type="submit" disabled={pin.length !== 6 || isSubmitting}>
                {isSubmitting ? 'Checking...' : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

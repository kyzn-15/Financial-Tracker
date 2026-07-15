import React, { useEffect, useRef, useState } from 'react';
import { getSystemStatus } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState('username');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [systemStatus, setSystemStatus] = useState('checking');
  const pinInputRef = useRef(null);
  const usernameInputRef = useRef(null);

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

  const handleUsernameSubmit = (event) => {
    event.preventDefault();
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setError('Enter your username.');
      return;
    }

    setError('');
    setStep('pin');
  };

  const handlePinSubmit = async (event) => {
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
      setError(err.message || 'Invalid username or PIN.');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinChange = (event) => {
    const nextPin = event.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(nextPin);
    if (error) setError('');
  };

  const handleBack = () => {
    setStep('username');
    setPin('');
    setError('');
  };

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">
          <span className="login-brand__mark">FT</span>
        </div>

        <div className="login-copy">
          <p className="login-kicker">Secure access</p>
          <h1 id="login-title" className="login-title">
            Financial Tracker
          </h1>
          <p className="login-subtitle">
            {step === 'username'
              ? 'Enter your username to continue.'
              : 'Enter your 6-digit PIN.'}
          </p>
        </div>

        <div className={`system-status system-status--${systemStatus}`} role="status" aria-live="polite">
          <span className="system-status__icon" aria-hidden="true" />
          <span>
            {systemStatus === 'operational' && 'All systems operational'}
            {systemStatus === 'checking' && 'Checking system status'}
            {systemStatus === 'issues' && 'System issues detected'}
          </span>
        </div>

        {step === 'username' ? (
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
              maxLength="6"
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

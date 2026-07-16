import React, { useEffect, useState } from 'react';

const FALLBACK_MYR_TO_IDR = 4500;

export default function Header({ exchangeRate, activeTab, currency, onCurrencyChange, onLogout, isLoggingOut }) {
  const [time, setTime] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    function updateTime() {
      setTime(new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Singapore',
      }));
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLiveRate = exchangeRate && !exchangeRate.usingFallback;
  const rateValue = isLiveRate ? exchangeRate.myrToIdr : FALLBACK_MYR_TO_IDR;
  const rateDisplay = Number(rateValue).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rateBadgeClass = exchangeRate
    ? (isLiveRate ? 'header__rate-badge header__rate-badge--live' : 'header__rate-badge header__rate-badge--fallback')
    : 'header__rate-badge';
  const rateTitle = exchangeRate
    ? (isLiveRate ? 'Live exchange rate from API' : 'Using safety fallback rate (API unavailable)')
    : 'Loading exchange rate...';
  const titles = {
    add: 'Add Expense', dashboard: 'Dashboard', receipts: 'Receipt Saver', emergency: 'Emergency Fund', history: 'Transaction History', settings: 'Settings',
  };

  return (
    <header className="header">
      <h2 className="header__title">{titles[activeTab] || ''}</h2>
      <div className="currency-toggle header__currency-toggle" aria-label="Display currency">
        <button type="button" className={`currency-toggle__btn ${currency === 'MYR' ? 'currency-toggle__btn--active' : ''}`} onClick={() => onCurrencyChange('MYR')}>MYR</button>
        <button type="button" className={`currency-toggle__btn ${currency === 'IDR' ? 'currency-toggle__btn--active' : ''}`} onClick={() => onCurrencyChange('IDR')}>IDR</button>
      </div>
      <div className={`header__details ${isDetailsOpen ? 'header__details--open' : ''}`}>
        <button
          className="header__details-toggle"
          type="button"
          aria-expanded={isDetailsOpen}
          aria-controls="header-secondary-details"
          aria-label={isDetailsOpen ? 'Hide header details' : 'Show header details'}
          onClick={() => setIsDetailsOpen((isOpen) => !isOpen)}
        >
          <span className="header__details-chevron" aria-hidden="true" />
        </button>
        <div className="header__info" id="header-secondary-details">
          <div className={rateBadgeClass} title={rateTitle}>
            <span aria-hidden="true">$</span>
            <span>1 MYR = <span className="rate-value">{rateDisplay}</span> IDR</span>
          </div>
          <div className="header__time">{time} (UTC+8)</div>
          <button className="header__logout-btn" type="button" onClick={onLogout} disabled={isLoggingOut} title="End this secure session">
            <span className="header__logout-icon" aria-hidden="true">X</span>
            <span>{isLoggingOut ? 'Logging out' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

import React, { useEffect, useState } from 'react';

const FALLBACK_MYR_TO_IDR = 4500;

export default function Header({ exchangeRate, activeTab, onLogout, isLoggingOut, onExportRecords, isExporting }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setTime(
        now.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Singapore',
        })
      );
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLiveRate = exchangeRate && !exchangeRate.usingFallback;
  const rateValue = isLiveRate ? exchangeRate.myrToIdr : FALLBACK_MYR_TO_IDR;
  const rateDisplay = Number(rateValue).toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const rateBadgeClass = exchangeRate
    ? (isLiveRate ? 'header__rate-badge header__rate-badge--live' : 'header__rate-badge header__rate-badge--fallback')
    : 'header__rate-badge';
  const rateTitle = exchangeRate
    ? (isLiveRate ? 'Live exchange rate from API' : 'Using safety fallback rate (API unavailable)')
    : 'Loading exchange rate...';

  const getTabTitle = () => {
    switch (activeTab) {
      case 'add': return 'Add Expense';
      case 'dashboard': return 'Dashboard';
      case 'receipts': return 'Receipt Saver';
      case 'emergency': return 'Emergency Fund';
      case 'history': return 'Transaction History';
      default: return '';
    }
  };

  return (
    <header className="header">
      <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)', margin: 0, paddingLeft: 'var(--space-sm)' }}>
        {getTabTitle()}
      </h2>
      <div className="header__info">
        <div className={rateBadgeClass} title={rateTitle}>
          <span aria-hidden="true">$</span>
          <span>1 MYR = <span className="rate-value">{rateDisplay}</span> IDR</span>
        </div>
        <div className="header__time">{time} (UTC+8)</div>
        <button
          className="header__export-btn"
          type="button"
          onClick={onExportRecords}
          disabled={isExporting}
          title="Export expense history, receipts, and emergency fund data"
        >
          <span className="header__export-icon" aria-hidden="true">📤</span>
          <span>{isExporting ? 'Exporting' : 'Export Records'}</span>
        </button>
        <button
          className="header__logout-btn"
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          title="End this secure session"
        >
          <span className="header__logout-icon" aria-hidden="true">X</span>
          <span>{isLoggingOut ? 'Logging out' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}


import React, { useState, useEffect } from 'react';

const FALLBACK_MYR_TO_IDR = 4500;

export default function Header({ exchangeRate, activeTab }) {
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
    : 'Loading exchange rate…';

  const getTabTitle = () => {
    switch (activeTab) {
      case 'add': return 'Add Expense';
      case 'dashboard': return 'Dashboard';
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
          <span>💱</span>
          <span>1 MYR = <span className="rate-value">{rateDisplay}</span> IDR</span>
        </div>
        <div className="header__time">🕐 {time} (UTC+8)</div>
      </div>
    </header>
  );
}

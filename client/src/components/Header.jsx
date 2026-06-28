import React, { useState, useEffect } from 'react';

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

  const rateDisplay = exchangeRate?.myrToIdr
    ? Number(exchangeRate.myrToIdr).toLocaleString('en', { maximumFractionDigits: 0 })
    : '—';
    
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
        <div className="header__rate-badge">
          <span>💱</span>
          <span>1 MYR = <span className="rate-value">{rateDisplay}</span> IDR</span>
        </div>
        <div className="header__time">🕐 {time} (UTC+8)</div>
      </div>
    </header>
  );
}

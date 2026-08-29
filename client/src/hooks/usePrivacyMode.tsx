import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatCurrencyAmount } from '../utils/formatters';
import type { Currency, NumericValue } from '../types';

const PRIVACY_MODE_KEY = 'financial-tracker-privacy-mode';

interface PrivacyModeContextValue {
  isPrivacyMode: boolean;
  setIsPrivacyMode: (enabled: boolean) => void;
  formatCurrency: (amount: NumericValue, currency: Currency, myrToIdr?: number) => string;
  formatPercentage: (percentage: number, options?: { includeSign?: boolean }) => string;
  maskValue: (value: string) => string;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function maskFormattedCurrency(formattedAmount: string): string {
  const firstDigitIndex = formattedAmount.search(/\d/);
  if (firstDigitIndex === -1) return `${formattedAmount} ***`;

  const currencyPrefix = formattedAmount
    .slice(0, firstDigitIndex)
    .replace(/[+\-−]\s*$/, '')
    .trimEnd();
  return `${currencyPrefix} ***`;
}

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const storedPreference = window.localStorage.getItem(PRIVACY_MODE_KEY);
    return storedPreference === null ? true : storedPreference === 'true';
  });

  useLayoutEffect(() => {
    window.localStorage.setItem(PRIVACY_MODE_KEY, String(isPrivacyMode));
  }, [isPrivacyMode]);

  const value = useMemo<PrivacyModeContextValue>(() => ({
    isPrivacyMode,
    setIsPrivacyMode,
    formatCurrency: (amount, currency, myrToIdr = 4500) => {
      const formattedAmount = formatCurrencyAmount(amount, currency, myrToIdr);
      return isPrivacyMode ? maskFormattedCurrency(formattedAmount) : formattedAmount;
    },
    formatPercentage: (percentage, { includeSign = false } = {}) => {
      if (isPrivacyMode) return `${includeSign && percentage > 0 ? '+' : ''}***%`;
      return `${includeSign && percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
    },
    maskValue: (value) => isPrivacyMode ? '***' : value,
  }), [isPrivacyMode]);

  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const context = useContext(PrivacyModeContext);
  if (!context) throw new Error('usePrivacyMode must be used inside PrivacyModeProvider.');
  return context;
}

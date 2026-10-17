import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatCurrencyAmount } from '../utils/formatters';
import type { Currency, NumericValue, PrivacyOnLoginPreference } from '../types';

export const PRIVACY_MODE_KEY = 'financial-tracker-privacy-mode';
export const PRIVACY_ON_LOGIN_KEY = 'financial-tracker-privacy-on-login';

const PRIVACY_ON_LOGIN_VALUES: readonly PrivacyOnLoginPreference[] = ['always-on', 'always-off', 'remember'];

interface PrivacyModeContextValue {
  isPrivacyMode: boolean;
  setIsPrivacyMode: (enabled: boolean) => void;
  privacyOnLogin: PrivacyOnLoginPreference;
  setPrivacyOnLogin: (preference: PrivacyOnLoginPreference) => void;
  formatCurrency: (amount: NumericValue, currency: Currency, myrToIdr?: number) => string;
  formatPercentage: (percentage: number, options?: { includeSign?: boolean }) => string;
  maskValue: (value: string) => string;
}

function parsePrivacyOnLoginPreference(value: string | null): PrivacyOnLoginPreference {
  return PRIVACY_ON_LOGIN_VALUES.includes(value as PrivacyOnLoginPreference)
    ? value as PrivacyOnLoginPreference
    : 'remember';
}

function parseStoredPrivacyMode(value: string | null): boolean {
  return value === null ? true : value === 'true';
}

function resolvePrivacyModeForSession(
  preference: PrivacyOnLoginPreference,
  lastPrivacyMode: boolean,
): boolean {
  if (preference === 'always-on') return true;
  if (preference === 'always-off') return false;
  return lastPrivacyMode;
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
  const [privacyOnLogin, setPrivacyOnLoginState] = useState<PrivacyOnLoginPreference>(() => (
    parsePrivacyOnLoginPreference(window.localStorage.getItem(PRIVACY_ON_LOGIN_KEY))
  ));
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => resolvePrivacyModeForSession(
    parsePrivacyOnLoginPreference(window.localStorage.getItem(PRIVACY_ON_LOGIN_KEY)),
    parseStoredPrivacyMode(window.localStorage.getItem(PRIVACY_MODE_KEY)),
  ));

  useLayoutEffect(() => {
    window.localStorage.setItem(PRIVACY_MODE_KEY, String(isPrivacyMode));
  }, [isPrivacyMode]);

  const setPrivacyOnLogin = useCallback((preference: PrivacyOnLoginPreference) => {
    setPrivacyOnLoginState(preference);
    window.localStorage.setItem(PRIVACY_ON_LOGIN_KEY, preference);
  }, []);

  const value = useMemo<PrivacyModeContextValue>(() => ({
    isPrivacyMode,
    setIsPrivacyMode,
    privacyOnLogin,
    setPrivacyOnLogin,
    formatCurrency: (amount, currency, myrToIdr = 4500) => {
      const formattedAmount = formatCurrencyAmount(amount, currency, myrToIdr);
      return isPrivacyMode ? maskFormattedCurrency(formattedAmount) : formattedAmount;
    },
    formatPercentage: (percentage, { includeSign = false } = {}) => {
      if (isPrivacyMode) return `${includeSign && percentage > 0 ? '+' : ''}***%`;
      return `${includeSign && percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
    },
    maskValue: (value) => isPrivacyMode ? '***' : value,
  }), [isPrivacyMode, privacyOnLogin, setIsPrivacyMode, setPrivacyOnLogin]);

  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const context = useContext(PrivacyModeContext);
  if (!context) throw new Error('usePrivacyMode must be used inside PrivacyModeProvider.');
  return context;
}

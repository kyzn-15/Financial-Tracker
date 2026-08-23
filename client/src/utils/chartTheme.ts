export interface ChartTheme {
  accent: string;
  success: string;
  danger: string;
  info: string;
  warning: string;
  purple: string;
  ink: string;
  surface: string;
  text: string;
  grid: string;
  accentFill: string;
}

export function getChartTheme(): ChartTheme {
  const styles = window.getComputedStyle(document.documentElement);
  const value = (name: string, fallback: string): string => styles.getPropertyValue(name).trim() || fallback;
  const isDark = document.documentElement.dataset.theme === 'dark';

  return {
    accent: value('--accent', '#FFAA5C'),
    success: value('--success', '#7BE495'),
    danger: value('--danger', '#FF7A7A'),
    info: value('--info', '#72B7FF'),
    warning: value('--warning', '#FFD95A'),
    purple: value('--purple-accent', '#B69CFF'),
    ink: value('--ink', '#171717'),
    surface: isDark ? '#23211A' : '#FFFFFF',
    text: value('--text-secondary', '#555043'),
    grid: isDark ? 'rgba(245, 239, 220, 0.18)' : 'rgba(23, 23, 23, 0.16)',
    accentFill: isDark ? 'rgba(255, 170, 92, 0.22)' : 'rgba(255, 170, 92, 0.18)',
  };
}

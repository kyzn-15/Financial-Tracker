export interface ChartTheme {
  accent: string;
  success: string;
  danger: string;
  info: string;
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
    accent: value('--accent', '#3d55ee'),
    success: value('--success', '#10b981'),
    danger: value('--danger', '#ef4444'),
    info: value('--info', '#06b6d4'),
    surface: value('--surface-raised', '#ffffff'),
    text: value('--text-secondary', '#51617a'),
    grid: isDark ? 'rgba(170, 182, 203, 0.13)' : 'rgba(81, 97, 122, 0.14)',
    accentFill: isDark ? 'rgba(128, 149, 245, 0.18)' : 'rgba(61, 85, 238, 0.12)',
  };
}

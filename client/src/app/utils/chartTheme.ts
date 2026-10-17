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
    accent: value('--accent', '#4a8bc2'),
    success: value('--success', '#4fe2a1'),
    danger: value('--danger', '#d3182d'),
    info: value('--info', '#74b9ff'),
    surface: value('--bg', '#ecf0f3'),
    text: value('--text-secondary', '#636e72'),
    grid: isDark ? 'rgba(188, 198, 207, 0.16)' : 'rgba(163, 177, 198, 0.2)',
    accentFill: isDark ? 'rgba(105, 174, 228, 0.16)' : 'rgba(74, 139, 194, 0.1)',
  };
}

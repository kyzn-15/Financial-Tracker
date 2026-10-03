import { useEffect } from 'react';

export function useLightCanvas() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = 'light';
    root.classList.add('landing-root');
    return () => {
      root.classList.remove('landing-root');
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, []);
}

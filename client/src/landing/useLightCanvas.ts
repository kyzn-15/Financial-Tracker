import { useLayoutEffect } from 'react';

export function useLightCanvas() {
  useLayoutEffect(() => {
    document.documentElement.classList.add('landing-root');
    return () => {
      document.documentElement.classList.remove('landing-root');
    };
  }, []);
}

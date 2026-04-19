import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('theme') as Theme) ?? 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}

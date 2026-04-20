import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'auto' | 'retro';
export type ResolvedTheme = 'dark' | 'light' | 'retro';

const THEME_EVENT = 'financeai:theme-change';

function resolveAuto(): 'dark' | 'light' {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function applyTheme(resolved: ResolvedTheme) {
  const el = document.documentElement;
  el.classList.remove('light', 'retro');
  if (resolved === 'light') el.classList.add('light');
  else if (resolved === 'retro') el.classList.add('retro');
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme') as Theme;
  if (saved === 'dark' || saved === 'light' || saved === 'auto' || saved === 'retro') return saved;
  return 'dark';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    const resolved: ResolvedTheme = theme === 'auto' ? resolveAuto() : theme;
    applyTheme(resolved);
    localStorage.setItem('theme', theme);

    if (theme !== 'auto') return;
    const id = setInterval(() => applyTheme(resolveAuto()), 60_000);
    return () => clearInterval(id);
  }, [theme]);

  useEffect(() => {
    const onChange = () => setThemeState(readTheme());
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const toggle = () => {
    setThemeState((t) => {
      const next: Theme = t === 'dark' ? 'light' : t === 'light' ? 'dark' : 'dark';
      localStorage.setItem('theme', next);
      window.dispatchEvent(new Event(THEME_EVENT));
      return next;
    });
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const resolved: ResolvedTheme = theme === 'auto' ? resolveAuto() : theme;
  return { theme, resolved, toggle, setTheme };
}

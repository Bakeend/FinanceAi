import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { openGlobalSearch } from '../components/GlobalSearchBar';

export function useKeyboardShortcuts(nav: NavigateFunction) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K opens global search regardless of focus
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openGlobalSearch();
        return;
      }

      // Ignore when typing in inputs/textareas/selects
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)) {
        if (e.key === 'Escape') (tgt as HTMLInputElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'd': nav('/'); break;
        case 't': nav('/transactions'); break;
        case 'n': nav('/new'); break;
        case 'u': nav('/upload'); break;
        case 'g': nav('/goals'); break;
        case 'i': nav('/insights'); break;
        case 'c': nav('/chat'); break;
        case '/': {
          e.preventDefault();
          openGlobalSearch();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);
}

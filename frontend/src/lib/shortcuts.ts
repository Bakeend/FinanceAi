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
        case 'n': nav('/adicionar'); break;
        case 'a': nav('/adicionar?tab=new'); break;
        case 'u': nav('/adicionar?tab=upload'); break;
        case 'g': nav('/planejamento?tab=goals'); break;
        case 'b': nav('/planejamento?tab=budgets'); break;
        case 'i': nav('/chat'); break;
        case 'c': nav('/chat'); break;
        case 'r': nav('/analise?tab=reports'); break;
        case 'p': nav('/profile'); break;
        case 's': { e.preventDefault(); openGlobalSearch(); break; }
        case '/': { e.preventDefault(); openGlobalSearch(); break; }
        case '?': {
          e.preventDefault();
          alert(
            'Atalhos:\n' +
            ' D → Dashboard\n' +
            ' T → Transações\n' +
            ' N → Adicionar transação\n' +
            ' U → Upload extrato\n' +
            ' G → Metas\n' +
            ' B → Orçamento\n' +
            ' R → Relatórios\n' +
            ' C / I → Luna & Insights\n' +
            ' P → Perfil\n' +
            ' S ou / → Busca\n' +
            ' Ctrl+K → Busca'
          );
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);
}

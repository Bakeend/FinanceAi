import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { api } from '../lib/api';
import type { MonthRef } from '../lib/types';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthSelector({ value, onChange }: { value: MonthRef; onChange: (v: MonthRef) => void }) {
  const [options, setOptions] = useState<MonthRef[]>([]);

  useEffect(() => {
    api.months().then((opts) => {
      setOptions(opts);
      // Se o mês selecionado não está na lista, pula pro mais recente com dados
      if (opts.length && !opts.some((o) => o.mes === value.mes && o.ano === value.ano)) {
        onChange(opts[0]);
      }
    }).catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Garante que o value atual aparece no dropdown mesmo se não estiver na lista do servidor
  const hasCurrent = options.some((o) => o.mes === value.mes && o.ano === value.ano);
  const all = hasCurrent ? options : [value, ...options];

  return (
    <div className="relative inline-flex items-center">
      <Calendar className="w-4 h-4 text-accent absolute left-3 pointer-events-none" />
      <select
        className="appearance-none pl-9 pr-9 py-2 bg-card border border-border rounded-xl text-sm text-slate-100 font-medium hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer"
        value={`${value.ano}-${value.mes}`}
        onChange={(e) => {
          const [a, m] = e.target.value.split('-').map(Number);
          onChange({ ano: a, mes: m });
        }}
      >
        {all.map((o) => (
          <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
            {MESES[o.mes - 1]} {o.ano}
          </option>
        ))}
      </select>
      <svg className="w-4 h-4 text-muted absolute right-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

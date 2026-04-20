import { useMemo } from 'react';
import type { Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function SpendingHeatmap({ items, mes, ano }: { items: Transaction[]; mes: number; ano: number }) {
  const { days, maxAbs } = useMemo(() => {
    const daysInMonth = new Date(ano, mes, 0).getDate();
    const byDay: Record<number, number> = {};
    for (const t of items) {
      if (t.valor < 0) {
        const d = Number(t.data.split('-')[2]);
        byDay[d] = (byDay[d] ?? 0) + Math.abs(t.valor);
      }
    }
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      total: byDay[i + 1] ?? 0,
      weekday: new Date(ano, mes - 1, i + 1).getDay(),
    }));
    const maxAbs = Math.max(...days.map((d) => d.total), 1);
    return { days, maxAbs };
  }, [items, mes, ano]);

  // pad start with empty cells
  const firstWeekday = days[0]?.weekday ?? 0;
  const cells = [...Array(firstWeekday).fill(null), ...days];

  const colorFor = (total: number) => {
    if (total === 0) return 'bg-border/40';
    const pct = total / maxAbs;
    if (pct < 0.2) return 'bg-rose-900/30';
    if (pct < 0.4) return 'bg-rose-800/50';
    if (pct < 0.6) return 'bg-rose-600/60';
    if (pct < 0.8) return 'bg-rose-500/75';
    return 'bg-rose-500';
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-slate-200 font-semibold mb-3">Mapa de calor de gastos</h3>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <div
              key={cell.day}
              title={`${cell.day}/${mes}: ${cell.total > 0 ? fmt(cell.total) : 'sem gastos'}`}
              className={`aspect-square rounded-md ${colorFor(cell.total)} flex items-center justify-center cursor-default transition-colors hover:opacity-80`}
            >
              <span className="text-[10px] text-slate-300/70 select-none">{cell.day}</span>
            </div>
          )
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted">
        <span>Menos</span>
        {['bg-border/40', 'bg-rose-900/30', 'bg-rose-700/50', 'bg-rose-600/60', 'bg-rose-500/75', 'bg-rose-500'].map((c, i) => (
          <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}

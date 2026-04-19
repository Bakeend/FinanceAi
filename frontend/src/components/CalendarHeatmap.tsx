import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import type { Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

type DayCell = { day: number; gasto: number; txs: Transaction[] };

function intensity(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio <= 0.25) return 0.15;
  if (ratio <= 0.5) return 0.3;
  if (ratio <= 0.75) return 0.55;
  if (ratio < 1) return 0.75;
  return 0.95;
}

export function CalendarHeatmap({ items, mes, ano }: { items: Transaction[]; mes: number; ano: number }) {
  const [selected, setSelected] = useState<number | null>(null);

  const { cells, max, firstWeekday, daysInMonth } = useMemo(() => {
    const daysInMonth = new Date(ano, mes, 0).getDate();
    const firstWeekday = new Date(ano, mes - 1, 1).getDay(); // 0=dom
    const byDay = new Map<number, DayCell>();
    for (let d = 1; d <= daysInMonth; d++) byDay.set(d, { day: d, gasto: 0, txs: [] });
    for (const t of items) {
      if (t.valor >= 0) continue;
      const day = Number(t.data.slice(8, 10));
      const c = byDay.get(day);
      if (!c) continue;
      c.gasto += Math.abs(t.valor);
      c.txs.push(t);
    }
    const cells = Array.from(byDay.values());
    const max = Math.max(1, ...cells.map((c) => c.gasto));
    return { cells, max, firstWeekday, daysInMonth };
  }, [items, mes, ano]);

  const selectedCell = selected ? cells.find((c) => c.day === selected) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26, duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-rose-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Calendário de gastos</h3>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] sm:text-[11px] uppercase text-muted mb-1">
        {WEEK.map((w) => (
          <div key={w} className="text-center tracking-wide">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {cells.map((c) => {
          const ratio = c.gasto / max;
          const op = intensity(ratio);
          const isSelected = selected === c.day;
          return (
            <button
              key={c.day}
              onClick={() => setSelected(isSelected ? null : c.day)}
              className={`relative aspect-square rounded-md sm:rounded-lg border transition-all text-left p-1 sm:p-1.5 flex flex-col justify-between ${
                isSelected ? 'border-rose-400/70' : 'border-border hover:border-rose-500/40'
              }`}
              style={{ backgroundColor: op > 0 ? `rgba(244, 63, 94, ${op})` : undefined }}
              title={c.gasto > 0 ? `Dia ${c.day}: ${fmt(c.gasto)}` : `Dia ${c.day}`}
            >
              <span className={`text-[10px] sm:text-xs font-medium ${op > 0.5 ? 'text-white' : 'text-slate-300'}`}>
                {c.day}
              </span>
              {c.gasto > 0 && (
                <span className={`text-[8px] sm:text-[10px] tabular-nums leading-none ${op > 0.5 ? 'text-white/90' : 'text-muted'}`}>
                  {c.gasto >= 1000 ? `${(c.gasto / 1000).toFixed(1)}k` : c.gasto.toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted">
        <span>menor</span>
        {[0.15, 0.3, 0.55, 0.75, 0.95].map((o) => (
          <span key={o} className="w-3 h-3 rounded" style={{ backgroundColor: `rgba(244, 63, 94, ${o})` }} />
        ))}
        <span>maior</span>
        <span className="ml-auto">{daysInMonth} dias</span>
      </div>

      <AnimatePresence>
        {selectedCell && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-3 rounded-xl border border-border bg-card-hover/60 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-200">
                Dia {selectedCell.day} · <span className="text-rose-400 tabular-nums">{fmt(selectedCell.gasto)}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {selectedCell.txs.length === 0 ? (
              <div className="text-xs text-muted">Sem gastos neste dia.</div>
            ) : (
              <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {selectedCell.txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300 truncate">{t.descricao}</span>
                    <span className="text-rose-400 tabular-nums shrink-0">{fmt(t.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, X } from 'lucide-react';
import { api } from '../lib/api';
import type { PriceIncrease } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PriceIncreaseBanner() {
  const [items, setItems] = useState<PriceIncrease[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('price-inc-dismissed') ?? '[]')));

  useEffect(() => {
    api.priceIncreases().then(setItems).catch(() => setItems([]));
  }, []);

  const visible = items.filter((i) => !dismissed.has(i.descricao));
  if (!visible.length) return null;

  const dismiss = (desc: string) => {
    const next = new Set(dismissed);
    next.add(desc);
    setDismissed(next);
    localStorage.setItem('price-inc-dismissed', JSON.stringify(Array.from(next)));
  };

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {visible.slice(0, 3).map((p) => (
          <motion.div
            key={p.descricao}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}
            className="rounded-xl border border-amber-700/40 bg-amber-900/20 p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 truncate">
                <span className="font-semibold text-amber-200">{p.descricao}</span> subiu {p.pct.toFixed(0)}%
              </div>
              <div className="text-[11px] text-muted">
                {fmt(p.anterior)} → {fmt(p.atual)} · desde {p.desdeQuando}
              </div>
            </div>
            <button onClick={() => dismiss(p.descricao)} className="text-muted hover:text-slate-200 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

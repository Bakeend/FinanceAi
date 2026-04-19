import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AnomalyItem } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AnomaliesBanner({ mes, ano }: { mes: number; ano: number }) {
  const [items, setItems] = useState<AnomalyItem[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.anomalies(mes, ano).then(setItems).catch(() => setItems([]));
    setHidden(new Set());
  }, [mes, ano]);

  const visible = items.filter((a) => !hidden.has(a.id)).slice(0, 5);
  if (!visible.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-amber-700/40 bg-amber-500/5 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-slate-200 font-semibold">Gastos fora do padrão</h3>
        <span className="ml-auto text-xs text-muted">{items.length} detectado(s)</span>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((a) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex items-center gap-3 rounded-xl border border-amber-700/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-200 truncate">{a.descricao}</span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-800/60 text-muted">
                    {a.categoria}
                  </span>
                </div>
                <div className="text-xs text-amber-300/90 mt-0.5 tabular-nums">
                  {a.multiplicador.toFixed(1)}x acima da mediana {fmt(Math.abs(a.medianaCategoria))}
                </div>
              </div>
              <div className="text-rose-400 font-semibold tabular-nums text-right shrink-0">
                {fmt(a.valor)}
              </div>
              <button
                onClick={() => setHidden((h) => new Set(h).add(a.id))}
                className="text-muted hover:text-slate-200 transition-colors"
                title="Dispensar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}

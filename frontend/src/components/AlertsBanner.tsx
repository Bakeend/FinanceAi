import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { AlertItem } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STYLES = {
  up: { border: 'border-rose-700/40', bg: 'bg-rose-500/10', icon: 'text-rose-400', strong: 'text-rose-300' },
  down: { border: 'border-emerald-700/40', bg: 'bg-emerald-500/10', icon: 'text-emerald-400', strong: 'text-emerald-300' },
  novo: { border: 'border-amber-700/40', bg: 'bg-amber-500/10', icon: 'text-amber-400', strong: 'text-amber-300' },
};

export function AlertsBanner({ mes, ano }: { mes: number; ano: number }) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.alerts(mes, ano).then(setItems).catch(() => setItems([]));
    setIdx(0);
  }, [mes, ano]);

  const visible = items.filter((a) => !hidden.has(a.categoria + a.tipo));
  if (!visible.length) return null;

  const cur = visible[Math.min(idx, visible.length - 1)];
  const key = cur.categoria + cur.tipo;
  const style = cur.tipo === 'novo' ? STYLES.novo : cur.tipo === 'aumento' ? STYLES.up : STYLES.down;
  const Icon = cur.tipo === 'novo' ? Zap : cur.tipo === 'aumento' ? TrendingUp : TrendingDown;

  const dismiss = () => {
    setHidden((h) => new Set(h).add(key));
    setIdx((i) => Math.max(0, i - 1));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.18 }}
          className={`flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-2.5 text-sm`}
        >
          <Icon className={`w-4 h-4 ${style.icon} shrink-0`} />
          <div className="flex-1 text-slate-200">
            {cur.tipo === 'novo' && <>Novo gasto em <span className="font-semibold">{cur.categoria}</span>: {fmt(cur.valor)}</>}
            {cur.tipo === 'aumento' && <>Gasto em <span className="font-semibold">{cur.categoria}</span> subiu <span className={`font-semibold ${style.strong}`}>{cur.pct.toFixed(0)}%</span> vs mês anterior ({fmt(cur.valor)})</>}
            {cur.tipo === 'queda' && <>Gasto em <span className="font-semibold">{cur.categoria}</span> caiu <span className={`font-semibold ${style.strong}`}>{Math.abs(cur.pct).toFixed(0)}%</span> vs mês anterior ({fmt(cur.valor)})</>}
          </div>
          {visible.length > 1 && (
            <div className="flex items-center gap-1 text-muted text-xs shrink-0">
              <button onClick={() => setIdx((i) => (i - 1 + visible.length) % visible.length)} className="hover:text-slate-200 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>{Math.min(idx, visible.length - 1) + 1}/{visible.length}</span>
              <button onClick={() => setIdx((i) => (i + 1) % visible.length)} className="hover:text-slate-200 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button onClick={dismiss} className="text-muted hover:text-slate-200 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

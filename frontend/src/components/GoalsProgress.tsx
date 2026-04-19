import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Goal } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function GoalsProgress({ mes, ano }: { mes: number; ano: number }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    api.listGoals(mes, ano).then(setGoals).catch(() => setGoals([]));
  }, [mes, ano]);

  if (!goals.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Target className="w-4 h-4 text-accent" />
        </div>
        <h3 className="text-slate-200 font-semibold">Metas do mês</h3>
        <Link to="/goals" className="ml-auto text-xs text-accent flex items-center gap-1 hover:underline">
          Gerenciar <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {goals.map((g) => {
          const pct = Math.min(100, g.percentual);
          const over = g.percentual > 100;
          const nearing = g.percentual >= 80 && g.percentual <= 100;
          const bar = over ? 'bg-rose-gradient' : nearing ? 'bg-amber-400' : 'bg-accent-gradient';
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">{g.categoria}</span>
                <span className={`tabular-nums ${over ? 'text-rose-400' : nearing ? 'text-amber-400' : 'text-muted'}`}>
                  {fmt(g.gasto)} / {fmt(g.valor)} · {g.percentual.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg-soft overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full ${bar} rounded-full`}
                />
              </div>
              {over && <div className="text-[10px] text-rose-400 mt-0.5">Passou da meta em {fmt(g.gasto - g.valor)}</div>}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

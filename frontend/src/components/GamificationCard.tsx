import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { api } from '../lib/api';
import type { Gamification } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function GamificationCard() {
  const [data, setData] = useState<Gamification | null>(null);

  useEffect(() => {
    api.gamification().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;
  const economizando = data.economiaVsMesAnterior > 0;
  const hasPrior = data.gastoAnterior > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-slate-200">Seu desempenho</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {hasPrior && (
          <Tile
            icon={economizando ? TrendingDown : TrendingUp}
            label={economizando ? 'Economizou' : 'Gastando mais'}
            value={fmt(Math.abs(data.economiaVsMesAnterior))}
            hint={`vs mês anterior (até dia ${data.dia}/${data.totalDias})`}
            tone={economizando ? 'emerald' : 'rose'}
          />
        )}
        {data.streakSemComerFora > 0 && (
          <Tile
            icon={Flame}
            label={`Streak`}
            value={`${data.streakSemComerFora}d`}
            hint="sem comer fora"
            tone="amber"
          />
        )}
        <Tile
          icon={Activity}
          label="Transações no mês"
          value={String(data.txsNoMes)}
          hint={`${data.dia}/${data.totalDias} dias`}
          tone="accent"
        />
      </div>
    </motion.div>
  );
}

function Tile({
  icon: Icon, label, value, hint, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone: 'emerald' | 'rose' | 'amber' | 'accent' }) {
  const c = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-accent';
  return (
    <div className="rounded-xl border border-border bg-bg-soft/50 p-3">
      <div className="flex items-center gap-1 text-[10px] text-muted uppercase tracking-wider">
        <Icon className={`w-3 h-3 ${c}`} /> {label}
      </div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${c}`}>{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, ArrowDownRight, ArrowUpRight, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import type { TodaySummary } from '../lib/types';
import { CategoryChip } from './CategoryChip';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TodayWidget() {
  const [data, setData] = useState<TodaySummary | null>(null);

  useEffect(() => {
    api.todaySummary().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;
  const { gastoHoje, entradaHoje, quantidadeHoje, gastoSemana, maiorGastoHoje } = data;
  const nenhumMovimento = quantidadeHoje === 0 && entradaHoje === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 via-card to-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sun className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-slate-200">Hoje</span>
        <span className="text-[11px] text-muted">{data.data.split('-').reverse().join('/')}</span>
      </div>

      {nenhumMovimento ? (
        <p className="text-sm text-muted">Nenhuma movimentação registrada hoje.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="Gasto hoje" value={fmt(gastoHoje)} tone="rose" Icon={ArrowDownRight} />
          <Tile label="Entrada hoje" value={fmt(entradaHoje)} tone="emerald" Icon={ArrowUpRight} />
          <Tile label="Transações" value={String(quantidadeHoje)} tone="accent" Icon={Calendar} />
          <Tile label="Últimos 7 dias" value={fmt(gastoSemana)} tone="rose" Icon={ArrowDownRight} />
        </div>
      )}

      {maiorGastoHoje && (
        <div className="mt-3 rounded-xl border border-border bg-bg-soft/60 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted">Maior gasto de hoje</div>
            <div className="text-sm text-slate-200 truncate">{maiorGastoHoje.descricao}</div>
            <div className="mt-1"><CategoryChip categoria={maiorGastoHoje.categoria} size="sm" /></div>
          </div>
          <div className="tabular-nums text-rose-300 font-semibold shrink-0">{fmt(maiorGastoHoje.valor)}</div>
        </div>
      )}
    </motion.div>
  );
}

function Tile({ label, value, tone, Icon }: { label: string; value: string; tone: 'rose' | 'emerald' | 'accent'; Icon: React.ComponentType<{ className?: string }> }) {
  const toneClass =
    tone === 'rose' ? 'text-rose-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-accent';
  return (
    <div className="rounded-xl border border-border bg-card/80 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted uppercase tracking-wider">
        <Icon className={`w-3 h-3 ${toneClass}`} />
        {label}
      </div>
      <div className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

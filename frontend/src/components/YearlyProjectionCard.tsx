import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import type { YearlyProjection } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function YearlyProjectionCard({ mes, ano }: { mes: number; ano: number }) {
  const [data, setData] = useState<YearlyProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .yearlyProjection(mes, ano)
      .then(setData)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [mes, ano]);

  if (loading && !data) {
    return <div className="skeleton h-48 rounded-2xl" />;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-700/40 bg-rose-900/10 p-4 text-sm text-rose-200">{error}</div>
    );
  }
  if (!data) return null;

  if (!data.suficiente) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5 flex items-start gap-3 text-sm text-muted"
      >
        <Info className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
        <div>
          <div className="font-medium text-slate-300 mb-0.5">Projeção até dezembro</div>
          Histórico insuficiente — preciso de pelo menos 2 meses.
        </div>
      </motion.div>
    );
  }

  const saldoPositivo = data.projecaoSaldoFim >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
          <Target className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="text-slate-200 font-semibold">Projeção até dezembro</h3>
          <p className="text-xs text-muted">Baseado na média dos últimos meses · {data.mesesRestantes} {data.mesesRestantes === 1 ? 'mês restante' : 'meses restantes'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-rose-700/30 bg-rose-500/5 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-rose-300/80">
            <TrendingDown className="w-3.5 h-3.5" /> Gastos estimados
          </div>
          <div className="text-2xl font-bold text-rose-400 tabular-nums mt-1">{fmt(data.projecaoGasto)}</div>
          <div className="text-[11px] text-muted mt-0.5">média {fmt(data.mediaGasto)}/mês</div>
        </div>
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300/80">
            <TrendingUp className="w-3.5 h-3.5" /> Entradas estimadas
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">{fmt(data.projecaoEntrada)}</div>
          <div className="text-[11px] text-muted mt-0.5">média {fmt(data.mediaEntrada)}/mês</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="text-xs uppercase tracking-wide text-muted">Saldo estimado ao fim do ano</div>
        <div className={`text-4xl font-bold tabular-nums mt-1 ${saldoPositivo ? 'gradient-text' : 'text-rose-400'}`}>
          {fmt(data.projecaoSaldoFim)}
        </div>
      </div>
    </motion.div>
  );
}

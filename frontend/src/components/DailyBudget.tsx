import { motion } from 'framer-motion';
import { Calendar, AlertTriangle, TrendingDown } from 'lucide-react';
import type { Goal, Summary } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DailyBudget({ summary, goals, mes, ano }: { summary: Summary; goals: Goal[]; mes: number; ano: number }) {
  const limites = goals.filter((g) => g.tipo === 'limite');
  const totalOrcamento = limites.reduce((s, g) => s + g.valor, 0);
  if (totalOrcamento <= 0) return null;

  const totalGasto = Math.abs(summary.totalGasto);
  const restante = Math.max(0, totalOrcamento - totalGasto);
  const today = new Date();
  const isCurrentMonth = today.getMonth() + 1 === mes && today.getFullYear() === ano;
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
  const diasRestantes = Math.max(1, daysInMonth - currentDay + 1);
  const porDia = restante / diasRestantes;
  const mediaGastaDia = currentDay > 0 ? totalGasto / currentDay : 0;
  const over = totalGasto >= totalOrcamento;
  const risky = !over && mediaGastaDia > porDia;

  const color = over ? 'rose' : risky ? 'amber' : 'emerald';
  const styles = {
    rose: { bg: 'from-rose-500/15 to-rose-500/5', border: 'border-rose-500/30', text: 'text-rose-300', icon: 'text-rose-400' },
    amber: { bg: 'from-amber-500/15 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400' },
    emerald: { bg: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: 'text-emerald-400' },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-gradient-to-br ${styles.bg} p-5`}
    >
      <div className="absolute inset-0 bg-card opacity-80 -z-10" />
      <div className="flex items-start gap-4 flex-wrap">
        <div className={`w-10 h-10 rounded-xl ${styles.icon} bg-white/5 flex items-center justify-center shrink-0`}>
          {over ? <AlertTriangle className="w-5 h-5" /> : risky ? <TrendingDown className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted uppercase tracking-wider">Orçamento diário</div>
          {over ? (
            <div className="mt-1">
              <div className={`text-xl font-bold ${styles.text}`}>Orçamento estourado</div>
              <div className="text-xs text-muted mt-0.5">
                Gasto {fmt(totalGasto)} de {fmt(totalOrcamento)} · excesso de {fmt(totalGasto - totalOrcamento)}
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <div className={`text-2xl font-bold ${styles.text} tabular-nums`}>
                {fmt(porDia)} <span className="text-sm font-normal text-muted">por dia</span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                {fmt(restante)} disponível · {diasRestantes} dia{diasRestantes === 1 ? '' : 's'} restante{diasRestantes === 1 ? '' : 's'}
                {risky && ` · média atual ${fmt(mediaGastaDia)}/dia`}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

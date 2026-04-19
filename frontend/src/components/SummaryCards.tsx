import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import type { Summary, Transaction } from '../lib/types';
import { Sparkline } from './Sparkline';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildDailySeries(items: Transaction[], mes: number, ano: number, kind: 'entrada' | 'gasto' | 'saldo'): number[] {
  const days = new Date(ano, mes, 0).getDate();
  const series = new Array(days).fill(0);
  for (const t of items) {
    if (t.isTransfer) continue;
    const d = Number(t.data.slice(8, 10));
    if (d < 1 || d > days) continue;
    if (kind === 'entrada' && t.valor > 0) series[d - 1] += t.valor;
    else if (kind === 'gasto' && t.valor < 0) series[d - 1] += Math.abs(t.valor);
  }
  if (kind === 'saldo') {
    let running = 0;
    return new Array(days).fill(0).map((_, i) => {
      const dayTotal = items.filter((t) => !t.isTransfer && Number(t.data.slice(8, 10)) === i + 1).reduce((s, t) => s + t.valor, 0);
      running += dayTotal;
      return running;
    });
  }
  return series;
}

export function SummaryCards({ data, items, mes, ano }: { data: Summary; items?: Transaction[]; mes?: number; ano?: number }) {
  const saldoPositive = data.saldo >= 0;
  const canSpark = Boolean(items && mes && ano);

  const cards = [
    {
      label: 'Entradas',
      value: data.totalEntrada,
      Icon: ArrowUpRight,
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      valueColor: 'text-emerald-400',
      glow: 'shadow-glow-emerald',
      sparkColor: '#10b981',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'entrada') : [],
    },
    {
      label: 'Gastos',
      value: data.totalGasto,
      Icon: ArrowDownRight,
      gradient: 'from-rose-500/20 to-rose-500/5',
      iconBg: 'bg-rose-500/20 text-rose-400',
      valueColor: 'text-rose-400',
      glow: 'shadow-glow-rose',
      sparkColor: '#f43f5e',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'gasto') : [],
    },
    {
      label: 'Saldo',
      value: data.saldo,
      Icon: Wallet,
      gradient: saldoPositive ? 'from-accent/20 to-accent/5' : 'from-rose-500/20 to-rose-500/5',
      iconBg: saldoPositive ? 'bg-accent/20 text-accent' : 'bg-rose-500/20 text-rose-400',
      valueColor: saldoPositive ? 'text-accent' : 'text-rose-400',
      glow: saldoPositive ? 'shadow-glow-accent' : 'shadow-glow-rose',
      sparkColor: saldoPositive ? '#38bdf8' : '#f43f5e',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'saldo') : [],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} p-5 transition-shadow duration-300`}
        >
          <div className="absolute inset-0 bg-card opacity-80 -z-10" />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-muted text-xs uppercase tracking-wider font-medium">{c.label}</div>
              <div className={`text-3xl font-bold mt-2 ${c.valueColor} tabular-nums`}>{fmt(c.value)}</div>
            </div>
            <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6`}>
              <c.Icon className="w-5 h-5" />
            </div>
          </div>
          {canSpark && c.series.length > 1 && (
            <div className="mt-3 opacity-80">
              <Sparkline values={c.series} color={c.sparkColor} height={28} width={220} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

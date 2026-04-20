import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import type { Summary, Transaction } from '../lib/types';
import { Sparkline } from './Sparkline';

const fmt = (n: number) => {
  const abs = Math.abs(n);
  return abs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

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
      prefix: '+',
      Icon: ArrowUpRight,
      bg: 'bg-[#84CC16]',
      sparkStroke: 'rgba(63, 98, 18, 0.55)',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'entrada') : [],
    },
    {
      label: 'Gastos',
      value: data.totalGasto,
      prefix: '-',
      Icon: ArrowDownRight,
      bg: 'bg-[#F87171]',
      sparkStroke: 'rgba(127, 29, 29, 0.55)',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'gasto') : [],
    },
    {
      label: 'Saldo',
      value: data.saldo,
      prefix: saldoPositive ? '' : '-',
      Icon: Wallet,
      bg: saldoPositive ? 'bg-[#8B5CF6]' : 'bg-[#F87171]',
      sparkStroke: saldoPositive ? 'rgba(49, 27, 92, 0.55)' : 'rgba(127, 29, 29, 0.55)',
      series: canSpark ? buildDailySeries(items!, mes!, ano!, 'saldo') : [],
    },
  ];

  return (
    <div data-tour="summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
          whileHover={{ y: -2, transition: { duration: 0.12 } }}
          className={`group relative overflow-hidden rounded-2xl ${c.bg} p-4 shadow-card`}
        >
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-900/80">
              {c.label}
            </div>
            <div className="w-7 h-7 rounded-lg bg-zinc-900/15 flex items-center justify-center text-zinc-900">
              <c.Icon className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10 mt-3 text-2xl md:text-[28px] font-extrabold text-zinc-900 tabular-nums leading-tight">
            {c.prefix && <span className="opacity-70 mr-0.5">{c.prefix}</span>}
            {fmt(c.value)}
          </div>
          {canSpark && c.series.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-90">
              <Sparkline values={c.series} color={c.sparkStroke} height={40} width={400} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

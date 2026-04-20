import { motion } from 'framer-motion';
import { Flame, CalendarDays, Hash, PiggyBank } from 'lucide-react';
import type { Summary, Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

export function ExtraStats({ summary, items, mes, ano }: { summary: Summary; items: Transaction[]; mes: number; ano: number }) {
  const expenses = items.filter((t) => t.valor < 0);
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const today = new Date();
  const isCurrentMonth = mes === today.getMonth() + 1 && ano === today.getFullYear();
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const dailyAvg = Math.abs(summary.totalGasto) / elapsedDays;
  const biggest = expenses.reduce<Transaction | null>((acc, t) => (!acc || t.valor < acc.valor ? t : acc), null);
  const savingsRate = summary.totalEntrada > 0
    ? Math.max(0, summary.saldo) / summary.totalEntrada * 100
    : 0;

  const cards = [
    {
      label: 'Média diária',
      value: fmt(dailyAvg),
      subtitle: isCurrentMonth ? `nos últimos ${elapsedDays} dias` : `sobre ${daysInMonth} dias`,
      Icon: CalendarDays,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      label: 'Maior gasto',
      value: biggest ? fmt(biggest.valor) : '—',
      subtitle: biggest ? `${fmtDate(biggest.data)} · ${biggest.descricao.slice(0, 32)}${biggest.descricao.length > 32 ? '…' : ''}` : 'Sem gastos',
      Icon: Flame,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Transações',
      value: String(items.length),
      subtitle: `${expenses.length} gasto${expenses.length === 1 ? '' : 's'} · ${items.length - expenses.length} entrada${items.length - expenses.length === 1 ? '' : 's'}`,
      Icon: Hash,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Taxa de poupança',
      value: `${savingsRate.toFixed(1)}%`,
      subtitle: summary.totalEntrada > 0 ? `${fmt(Math.max(0, summary.saldo))} de ${fmt(summary.totalEntrada)}` : 'Sem entradas',
      Icon: PiggyBank,
      color: savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-rose-400',
      bg: savingsRate >= 20 ? 'bg-emerald-500/10' : savingsRate >= 10 ? 'bg-amber-500/10' : 'bg-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.Icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>
            <div className="text-xs text-muted uppercase tracking-wider font-medium">{c.label}</div>
          </div>
          <div className={`text-xl font-bold mt-2 tabular-nums ${c.color}`}>{c.value}</div>
          <div className="text-[11px] text-muted mt-1 truncate">{c.subtitle}</div>
        </motion.div>
      ))}
    </div>
  );
}

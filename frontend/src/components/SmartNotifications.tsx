
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Flame, Calendar, Clock,
  Trophy, Wallet, PiggyBank, AlertTriangle,
} from 'lucide-react';

import type { Summary, Transaction } from '../lib/types';

type Notif = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  color: 'accent' | 'emerald' | 'rose' | 'amber' | 'violet';
  priority: number;
};

const COLOR_MAP = {
  accent: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#a78bfa' },
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7' },
  rose: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)', text: '#fda4af' },
  amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d' },
  violet: { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', text: '#c4b5fd' },
};

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

function buildNotifications(
  items: Transaction[],
  summary: Summary | null,
  mes: number,
  ano: number,
): Notif[] {
  const notifs: Notif[] = [];
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const percentMonth = dayOfMonth / daysInMonth;

  const expenses = items.filter((t) => t.valor < 0 && !t.isTransfer);
  const totalGasto = Math.abs(expenses.reduce((s, t) => s + t.valor, 0));

  // ── 1) Ritmo de gastos ──
  if (summary && totalGasto > 0 && percentMonth > 0.1) {
    const projected = totalGasto / percentMonth;
    const lastMonthTotal = Math.abs(summary.totalGasto ?? 0);
    if (lastMonthTotal > 0) {
      const ratio = projected / lastMonthTotal;
      if (ratio > 1.2) {
        notifs.push({
          id: 'pace-high',
          icon: <TrendingUp className="w-4 h-4" />,
          title: 'Ritmo acelerado',
          body: `No ritmo atual, você vai gastar R$ ${projected.toFixed(0)} este mês — ${Math.round((ratio - 1) * 100)}% a mais que o mês passado.`,
          color: 'rose',
          priority: 10,
        });
      } else if (ratio < 0.8) {
        notifs.push({
          id: 'pace-low',
          icon: <TrendingDown className="w-4 h-4" />,
          title: 'Ritmo controlado 🎉',
          body: `Projeção de R$ ${projected.toFixed(0)} — ${Math.round((1 - ratio) * 100)}% menos que o mês passado. Continue assim!`,
          color: 'emerald',
          priority: 5,
        });
      }
    }
  }

  // ── 2) Dias sem gastar (streak) ──
  if (expenses.length > 0) {
    const sortedDates = [...new Set(expenses.map((t) => t.data))].sort().reverse();
    const lastExpenseDate = sortedDates[0];
    const streak = daysSince(lastExpenseDate);
    if (streak >= 2) {
      notifs.push({
        id: 'no-spend-streak',
        icon: <Flame className="w-4 h-4" />,
        title: `${streak} dias sem gastar!`,
        body: streak >= 5
          ? 'Incrível! Você está no controle total dos seus gastos.'
          : 'Boa! Cada dia sem gastos desnecessários conta.',
        color: streak >= 5 ? 'emerald' : 'amber',
        priority: 7,
      });
    }
  }

  // ── 3) Inatividade ──
  if (items.length > 0) {
    const allDates = items.map((t) => t.data).sort().reverse();
    const lastAny = allDates[0];
    const inactiveDays = daysSince(lastAny);
    if (inactiveDays >= 3) {
      notifs.push({
        id: 'inactivity',
        icon: <Clock className="w-4 h-4" />,
        title: 'Faz tempo!',
        body: `Última transação foi há ${inactiveDays} dias. Registre seus gastos para manter o controle.`,
        color: 'amber',
        priority: 8,
      });
    }
  } else if (items.length === 0) {
    notifs.push({
      id: 'empty-month',
      icon: <Calendar className="w-4 h-4" />,
      title: 'Mês vazio',
      body: 'Nenhuma transação registrada. Importe um extrato ou adicione manualmente.',
      color: 'violet',
      priority: 3,
    });
  }

  // ── 4) Marco de categoria ──
  if (summary && summary.porCategoria) {
    const thresholds = [1000, 500, 250];
    for (const cat of summary.porCategoria) {
      const val = Math.abs(cat.total);
      for (const threshold of thresholds) {
        if (val >= threshold) {
          notifs.push({
            id: `cat-milestone-${cat.categoria}-${threshold}`,
            icon: <AlertTriangle className="w-4 h-4" />,
            title: `${cat.categoria} passou de R$ ${threshold}`,
            body: `Você já gastou R$ ${val.toFixed(0)} em ${cat.categoria} este mês.`,
            color: 'rose',
            priority: 6,
          });
          break; // only show highest threshold
        }
      }
    }
  }

  // ── 5) Saldo positivo ──
  if (summary) {
    const saldo = (summary.totalEntrada ?? 0) + (summary.totalGasto ?? 0);
    if (saldo > 0 && totalGasto > 0) {
      const savingsRate = (saldo / (summary.totalEntrada ?? 1)) * 100;
      if (savingsRate >= 20) {
        notifs.push({
          id: 'savings-rate',
          icon: <PiggyBank className="w-4 h-4" />,
          title: `Guardando ${savingsRate.toFixed(0)}% da renda`,
          body: 'Excelente taxa de poupança! Você está construindo sua reserva.',
          color: 'emerald',
          priority: 4,
        });
      }
    } else if (saldo < 0 && (summary.totalEntrada ?? 0) > 0) {
      notifs.push({
        id: 'negative-balance',
        icon: <Wallet className="w-4 h-4" />,
        title: 'Gastou mais do que ganhou',
        body: `Saldo negativo de R$ ${Math.abs(saldo).toFixed(2)} neste mês. Cuidado!`,
        color: 'rose',
        priority: 9,
      });
    }
  }

  // ── 6) Maior gasto único ──
  if (expenses.length > 0) {
    const biggest = expenses.reduce((a, b) => (a.valor < b.valor ? a : b));
    const bigVal = Math.abs(biggest.valor);
    if (bigVal >= 200 && totalGasto > 0 && bigVal / totalGasto >= 0.15) {
      notifs.push({
        id: 'big-single',
        icon: <Trophy className="w-4 h-4" />,
        title: 'Gasto expressivo',
        body: `"${biggest.descricao.slice(0, 40)}" de R$ ${bigVal.toFixed(2)} representa ${Math.round((bigVal / totalGasto) * 100)}% dos seus gastos do mês.`,
        color: 'amber',
        priority: 5,
      });
    }
  }

  return notifs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function SmartNotifications({
  mes,
  ano,
  summary,
  items,
}: {
  mes: number;
  ano: number;
  summary: Summary | null;
  items: Transaction[];
}) {
  const notifs = buildNotifications(items, summary, mes, ano);

  if (notifs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1">
        Insights inteligentes
      </p>
      {notifs.map((n, i) => {
        const c = COLOR_MAP[n.color];
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="flex gap-3 p-3 rounded-xl border"
            style={{
              backgroundColor: c.bg,
              borderColor: c.border,
            }}
          >
            <div
              className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: c.border, color: c.text }}
            >
              {n.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold" style={{ color: c.text }}>
                {n.title}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                {n.body}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

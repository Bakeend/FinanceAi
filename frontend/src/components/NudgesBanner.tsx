import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, AlertTriangle, Zap, X } from 'lucide-react';
import { LunaAvatar } from './LunaAvatar';
import { api } from '../lib/api';
import type { Budget, Summary, Transaction } from '../lib/types';

type Nudge = {
  id: string;
  level: 'info' | 'warn' | 'tip';
  text: string;
};

const fmt = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildNudges(args: {
  summary: Summary | null;
  items: Transaction[];
  budgets: Budget[];
  mes: number;
  ano: number;
}): Nudge[] {
  const { summary, items, budgets, mes, ano } = args;
  const out: Nudge[] = [];
  const today = new Date();
  const isCurrent = today.getMonth() + 1 === mes && today.getFullYear() === ano;
  const elapsedDays = isCurrent ? today.getDate() : new Date(ano, mes, 0).getDate();
  const totalDays = new Date(ano, mes, 0).getDate();
  const daysLeft = Math.max(0, totalDays - elapsedDays);

  // Budget projections
  for (const b of budgets) {
    if (!isCurrent) continue;
    if (b.status === 'estourado') {
      out.push({
        id: `bud-${b.id}-est`,
        level: 'warn',
        text: `${b.categoria} já estourou o orçamento — R$${fmt(Math.abs(b.gasto - b.valor))} acima.`,
      });
      continue;
    }
    if (b.projecao > b.valor && b.gasto > 0) {
      const overflow = b.projecao - b.valor;
      const dailyRate = b.gasto / Math.max(1, elapsedDays);
      const willHitDay = Math.ceil(b.valor / Math.max(0.01, dailyRate));
      const inDays = Math.max(1, willHitDay - elapsedDays);
      out.push({
        id: `bud-${b.id}-proj`,
        level: 'warn',
        text: `Nesse ritmo, ${b.categoria} estoura em ~${inDays} dia${inDays === 1 ? '' : 's'} (R$${fmt(overflow)} acima).`,
      });
    } else if (b.percentual >= 80 && b.percentual < 100) {
      out.push({
        id: `bud-${b.id}-warn`,
        level: 'info',
        text: `${b.categoria}: usou ${b.percentual.toFixed(0)}% do orçamento. Restam R$${fmt(b.restante)}.`,
      });
    }
  }

  // Saldo trajectory
  if (summary && isCurrent && elapsedDays >= 5) {
    const dailySpend = Math.abs(summary.totalGasto) / elapsedDays;
    const projectedTotal = dailySpend * totalDays;
    const projectedSaldo = summary.totalEntrada - projectedTotal;
    if (summary.saldo > 0 && projectedSaldo < 0) {
      out.push({
        id: 'saldo-warn',
        level: 'warn',
        text: `Mês ainda no azul, mas no ritmo atual fecha negativo em ~R$${fmt(Math.abs(projectedSaldo))}.`,
      });
    } else if (projectedSaldo > summary.totalEntrada * 0.3) {
      out.push({
        id: 'saldo-tip',
        level: 'tip',
        text: `Tá indo bem — projeção de fechar com R$${fmt(projectedSaldo)} sobrando.`,
      });
    }
  }

  // Big single expense alert
  const last7 = items
    .filter((t) => !t.isTransfer && t.valor < 0)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 30);
  const avg = last7.length ? last7.reduce((s, t) => s + Math.abs(t.valor), 0) / last7.length : 0;
  const big = last7.find((t) => Math.abs(t.valor) > avg * 4 && Math.abs(t.valor) > 100);
  if (big && avg > 0) {
    out.push({
      id: `big-${big.id}`,
      level: 'info',
      text: `Gasto fora do padrão: ${big.descricao} (R$${fmt(big.valor)}) — 4x sua média.`,
    });
  }

  // Days left reminder
  if (isCurrent && daysLeft <= 7 && daysLeft > 0 && summary && summary.saldo > 0) {
    const dailyAllowance = summary.saldo / daysLeft;
    out.push({
      id: 'daysleft',
      level: 'tip',
      text: `Faltam ${daysLeft} dia${daysLeft === 1 ? '' : 's'} no mês. Você tem R$${fmt(dailyAllowance)} por dia pra usar sem ficar no vermelho.`,
    });
  }

  return out.slice(0, 4);
}

const DISMISSED_KEY = 'financeai-nudges-dismissed';
function readDismissed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function writeDismissed(s: Set<string>) {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
}

export function NudgesBanner({ summary, items, mes, ano }: { summary: Summary | null; items: Transaction[]; mes: number; ano: number }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  useEffect(() => {
    api.listBudgets(mes, ano).then(setBudgets).catch(() => setBudgets([]));
  }, [mes, ano]);

  const nudges = useMemo(
    () => buildNudges({ summary, items, budgets, mes, ano }).filter((n) => !dismissed.has(n.id)),
    [summary, items, budgets, mes, ano, dismissed],
  );

  if (!summary || nudges.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-pink-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <LunaAvatar size="sm" />
        <div>
          <div className="text-sm font-bold text-slate-100">A Luna observou…</div>
          <div className="text-[10px] text-muted">{nudges.length} {nudges.length === 1 ? 'insight' : 'insights'} pra você</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {nudges.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
                n.level === 'warn'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : n.level === 'tip'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border bg-bg-soft'
              }`}>
                <div className="shrink-0">
                  {n.level === 'warn' ? <AlertTriangle className="w-4 h-4 text-rose-400" />
                    : n.level === 'tip' ? <Zap className="w-4 h-4 text-emerald-400" />
                    : <TrendingUp className="w-4 h-4 text-accent" />}
                </div>
                <p className="flex-1 text-xs text-slate-200 leading-relaxed">{n.text}</p>
                <button
                  onClick={() => dismiss(n.id)}
                  className="shrink-0 text-muted hover:text-slate-200 -mr-1"
                  aria-label="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

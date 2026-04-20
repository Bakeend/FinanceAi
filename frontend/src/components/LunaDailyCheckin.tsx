import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LunaAvatar } from './LunaAvatar';
import type { Summary, Transaction } from '../lib/types';

const fmt = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SEEN_KEY_PREFIX = 'financeai-checkin-seen-';

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function buildMessage(summary: Summary, items: Transaction[], mes: number, ano: number): string {
  const today = new Date();
  const isCurrent = today.getMonth() + 1 === mes && today.getFullYear() === ano;
  const elapsedDays = isCurrent ? today.getDate() : new Date(ano, mes, 0).getDate();
  const daysLeft = Math.max(0, new Date(ano, mes, 0).getDate() - elapsedDays);
  const todayStr = today.toISOString().slice(0, 10);

  const todayItems = items.filter((t) => !t.isTransfer && t.data === todayStr);
  const todayGasto = todayItems.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
  const todayEntrada = todayItems.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0);

  // No activity today
  if (isCurrent && todayItems.length === 0) {
    if (summary.saldo > 0 && daysLeft > 0) {
      const perDay = summary.saldo / daysLeft;
      return `Hoje ainda sem lançamentos. Você tem R$${fmt(perDay)} por dia até o fim do mês sem ficar no vermelho.`;
    }
    return `Hoje ainda sem lançamentos. Quando rolar algo, me avisa.`;
  }

  if (todayEntrada > 0 && todayGasto === 0) {
    return `Bom dia de entradas — R$${fmt(todayEntrada)} hoje. Saldo do mês tá em R$${fmt(summary.saldo)}.`;
  }
  if (todayGasto > 0) {
    const biggest = todayItems.filter((t) => t.valor < 0).sort((a, b) => a.valor - b.valor)[0];
    return `Hoje você gastou R$${fmt(todayGasto)} em ${todayItems.filter((t) => t.valor < 0).length} ${todayItems.filter((t) => t.valor < 0).length === 1 ? 'item' : 'itens'}${biggest ? ` (maior: ${biggest.descricao})` : ''}.`;
  }
  return `Saldo do mês: R$${fmt(summary.saldo)}.`;
}

export function LunaDailyCheckin({ summary, items, mes, ano }: { summary: Summary | null; items: Transaction[]; mes: number; ano: number }) {
  const [dismissed, setDismissed] = useState(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const seenKey = SEEN_KEY_PREFIX + todayKey;

  useEffect(() => {
    if (sessionStorage.getItem(seenKey) === '1') setDismissed(true);
  }, [seenKey]);

  if (!summary || dismissed) return null;
  const today = new Date();
  const isCurrent = today.getMonth() + 1 === mes && today.getFullYear() === ano;
  if (!isCurrent) return null;

  const msg = buildMessage(summary, items, mes, ano);
  const greeting = timeOfDayGreeting();

  const close = () => {
    sessionStorage.setItem(seenKey, '1');
    setDismissed(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3"
      style={{
        backgroundImage:
          'radial-gradient(at 0% 0%, rgba(109, 40, 217, 0.12) 0%, transparent 55%)',
      }}
    >
      <LunaAvatar size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted">{greeting}</div>
        <div className="text-sm text-slate-100 leading-relaxed mt-0.5">{msg}</div>
      </div>
      <button
        onClick={close}
        className="text-[10px] uppercase tracking-wider font-bold text-muted hover:text-slate-200 transition-colors"
      >
        ok
      </button>
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Summary } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function QuickSummaryWidget() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open || summary) return;
    const now = new Date();
    api.summary(now.getMonth() + 1, now.getFullYear()).then(setSummary).catch(() => {});
  }, [open]);

  const saldo = summary?.saldo ?? 0;

  const saldoColor = saldo > 0 ? 'text-emerald-400' : saldo < 0 ? 'text-rose-400' : 'text-muted';

  return (
    <>
      {/* Floating pill — only on desktop, positioned above bottom nav on mobile */}
      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-border bg-card shadow-2xl p-4 w-56"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted uppercase tracking-wider font-medium">Este mês</span>
                <button onClick={() => setOpen(false)} className="text-muted hover:text-slate-200 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {!summary ? (
                <div className="text-xs text-muted">Carregando…</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Entradas</span>
                    <span className="text-sm font-semibold text-emerald-400 tabular-nums">{fmt(summary.totalEntrada)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Gastos</span>
                    <span className="text-sm font-semibold text-rose-400 tabular-nums">{fmt(Math.abs(summary.totalGasto))}</span>
                  </div>
                  <div className="h-px bg-border/60 my-0.5" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Saldo</span>
                    <span className={`text-base font-bold tabular-nums ${saldoColor}`}>{fmt(saldo)}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen((o) => !o)}
          className="w-12 h-12 rounded-full bg-accent shadow-glow-accent flex items-center justify-center text-slate-900"
          title="Resumo rápido"
        >
          <Wallet className="w-5 h-5" />
        </motion.button>
      </div>
    </>
  );
}

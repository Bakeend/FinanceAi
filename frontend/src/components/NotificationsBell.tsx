import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { AlertsBanner } from './AlertsBanner';
import { AnomaliesBanner } from './AnomaliesBanner';
import { UpcomingReminders } from './UpcomingReminders';
import { PriceIncreaseBanner } from './PriceIncreaseBanner';
import { NudgesBanner } from './NudgesBanner';
import { SmartNotifications } from './SmartNotifications';
import type { Summary, Transaction } from '../lib/types';

export function NotificationsBell({
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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((o) => !o)}
        title="Notificações"
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          open
            ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-accent'
            : 'border-border bg-card hover:bg-card-hover text-slate-300 hover:text-accent'
        }`}
      >
        <Bell className="w-[18px] h-[18px]" />
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop (mobile) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 z-50 w-[90vw] md:w-[420px] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl shadow-black/40"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-2xl">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent" />
                  Notificações
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-slate-200 hover:bg-card-hover transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-3 flex flex-col gap-3">
                {/* Smart insights first */}
                <SmartNotifications mes={mes} ano={ano} summary={summary} items={items} />

                {/* Divider */}
                <div className="flex items-center gap-2 px-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Alertas do sistema</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <AlertsBanner mes={mes} ano={ano} />
                <AnomaliesBanner mes={mes} ano={ano} />
                <UpcomingReminders />
                <PriceIncreaseBanner />
                <NudgesBanner summary={summary} items={items} mes={mes} ano={ano} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

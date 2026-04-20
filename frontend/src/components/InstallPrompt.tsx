import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { LunaAvatar } from './LunaAvatar';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'financeai-install-dismissed-at';
const INSTALLED_KEY = 'financeai-installed';
const SNOOZE_DAYS = 7;

function shouldShow() {
  if (localStorage.getItem(INSTALLED_KEY) === '1') return false;
  const at = localStorage.getItem(DISMISSED_KEY);
  if (!at) return true;
  const days = (Date.now() - Number(at)) / (1000 * 60 * 60 * 24);
  return days > SNOOZE_DAYS;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onBI = (e: Event) => {
      e.preventDefault();
      if (!shouldShow()) return;
      setEvt(e as BIPEvent);
      // Wait a bit so it doesn't pop the moment user lands
      setTimeout(() => setOpen(true), 4000);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      setOpen(false);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onBI);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBI);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1');
      } else {
        localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      }
    } catch { /* noop */ }
    setOpen(false);
    setEvt(null);
  };

  const snooze = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && evt && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed left-3 right-3 md:left-auto md:right-6 bottom-24 md:bottom-6 z-[180] max-w-sm rounded-2xl border border-border bg-card shadow-card p-4"
          style={{
            backgroundImage:
              'radial-gradient(at 0% 0%, rgba(109, 40, 217, 0.18) 0%, transparent 55%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.10) 0%, transparent 55%)',
          }}
        >
          <button
            onClick={snooze}
            aria-label="Mais tarde"
            className="absolute top-2 right-2 w-7 h-7 rounded-lg hover:bg-card-hover flex items-center justify-center text-muted hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 mb-3">
            <LunaAvatar size="md" />
            <div className="flex-1 min-w-0 pr-6">
              <div className="text-sm font-bold text-slate-100">Quer me deixar mais perto?</div>
              <div className="text-xs text-muted mt-1">
                Instala o FinanceAi como app — abre direto, sem barra de navegador.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={snooze}
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-bg-soft text-slate-200 text-sm hover:bg-card-hover"
            >
              Depois
            </button>
            <button
              onClick={install}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-bold text-sm shadow-glow-accent hover:bg-accent-gradient-hover"
            >
              <Download className="w-4 h-4" /> Instalar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

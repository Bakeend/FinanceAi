import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { X, Upload, Target, ArrowLeftRight, Sparkles, Sun, Moon, CreditCard, Bell, Download, PieChart, Zap, BarChart3, Plane, Clipboard, TrendingUp, User as UserIcon } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { onInstallAvailable, promptInstall } from '../lib/pwa';

type Item = { to: string; label: string; icon: typeof Upload };
const groups: { title: string; items: Item[] }[] = [
  {
    title: 'Dinheiro',
    items: [
      { to: '/accounts', label: 'Contas & cartões', icon: CreditCard },
      { to: '/budgets', label: 'Orçamento', icon: PieChart },
      { to: '/goals', label: 'Metas', icon: Target },
      { to: '/reminders', label: 'Lembretes', icon: Bell },
      { to: '/investments', label: 'Investimentos', icon: TrendingUp },
      { to: '/trips', label: 'Viagens', icon: Plane },
    ],
  },
  {
    title: 'Entrada de dados',
    items: [
      { to: '/upload', label: 'Upload', icon: Upload },
      { to: '/paste', label: 'Colar texto', icon: Clipboard },
      { to: '/rules', label: 'Regras', icon: Zap },
    ],
  },
  {
    title: 'Análise',
    items: [
      { to: '/reports', label: 'Relatórios', icon: BarChart3 },
      { to: '/insights', label: 'Insights IA', icon: Sparkles },
      { to: '/compare', label: 'Comparar', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/profile', label: 'Meu perfil', icon: UserIcon },
    ],
  },
];

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, toggle } = useTheme();
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    return onInstallAvailable(setCanInstall);
  }, []);

  const install = async () => {
    const ok = await promptInstall();
    if (ok) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 inset-x-0 glass rounded-t-2xl border-t border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Mais</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card-hover flex items-center justify-center text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto -mx-1 px-1">
              {groups.map((g) => (
                <div key={g.title}>
                  <div className="text-[10px] text-muted uppercase tracking-wider px-1 mb-1.5">{g.title}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                            isActive
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-border bg-card-hover/30 text-slate-200 hover:border-accent/30 hover:bg-accent/5'
                          }`
                        }
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <i.icon className="w-4 h-4 text-accent" />
                        </div>
                        <div className="text-sm font-medium truncate">{i.label}</div>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {canInstall && (
              <button
                onClick={install}
                className="mt-3 w-full flex items-center gap-3 p-3 rounded-xl border border-accent/40 bg-accent/10 text-accent"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="text-sm font-medium">Instalar como app</div>
              </button>
            )}

            <button
              onClick={() => { toggle(); onClose(); }}
              className="mt-3 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card-hover/30 text-slate-200"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
              </div>
              <div className="text-sm font-medium">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</div>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Upload, Sparkles, MessageCircle, Wallet, ListOrdered, PlusCircle, Target, Sun, Moon, ArrowLeftRight, CreditCard, Bell, Search, PieChart, Zap, BarChart3, Plane, Clipboard, TrendingUp, User as UserIcon, Lock } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { openGlobalSearch } from './GlobalSearchBar';
import { useAuth } from '../lib/auth';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transações', icon: ListOrdered },
  { to: '/accounts', label: 'Contas', icon: CreditCard },
  { to: '/budgets', label: 'Orçamento', icon: PieChart },
  { to: '/investments', label: 'Investimentos', icon: TrendingUp },
  { to: '/trips', label: 'Viagens', icon: Plane },
  { to: '/new', label: 'Nova', icon: PlusCircle },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/paste', label: 'Colar texto', icon: Clipboard },
  { to: '/rules', label: 'Regras', icon: Zap },
  { to: '/reports', label: 'Relatórios', icon: BarChart3 },
  { to: '/goals', label: 'Metas', icon: Target },
  { to: '/reminders', label: 'Lembretes', icon: Bell },
  { to: '/compare', label: 'Comparar', icon: ArrowLeftRight },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/profile', label: 'Perfil', icon: UserIcon },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex flex-col w-60 glass border-r border-border p-5 gap-1 sticky top-0 h-screen overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 mb-6 shrink-0"
      >
        <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow-accent">
          <Wallet className="w-5 h-5 text-slate-900" />
        </div>
        <h1 className="text-xl font-bold gradient-text">FinanceAi</h1>
      </motion.div>

      <button
        onClick={openGlobalSearch}
        className="shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card/50 hover:bg-card-hover text-slate-400 hover:text-slate-100 text-sm transition-colors mb-3"
      >
        <Search className="w-4 h-4 text-accent shrink-0" />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">Ctrl K</kbd>
      </button>

      <div className="flex flex-col gap-1 min-h-0 flex-1 overflow-y-auto -mr-2 pr-2">
        {items.map((i, idx) => (
          <motion.div
            key={i.to}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
          >
            <NavLink
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-accent'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-card-hover/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <i.icon className={`w-5 h-5 relative z-10 transition-transform group-hover:scale-110 ${isActive ? 'text-accent' : ''}`} />
                  <span className="relative z-10 text-sm font-medium">{i.label}</span>
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </div>

      <div className="shrink-0 mt-4 pt-4 border-t border-border flex flex-col gap-2">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="flex-1 truncate text-slate-300">{user.username}</span>
            <button title="Trancar" onClick={logout} className="text-muted hover:text-amber-300 p-1">
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-card-hover text-slate-300 text-sm transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
          <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
      </div>
    </aside>
  );
}

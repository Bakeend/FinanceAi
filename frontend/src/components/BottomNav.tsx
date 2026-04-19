import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, ListOrdered, Plus, MessageCircle, MoreHorizontal } from 'lucide-react';
import { MoreSheet } from './MoreSheet';

const left = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transações', icon: ListOrdered },
];
const right = [
  { to: '/chat', label: 'Chat', icon: MessageCircle },
];

export function BottomNav() {
  const [more, setMore] = useState(false);
  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 glass border-t border-border z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-end py-2 relative">
          {left.map((i) => (
            <NavItem key={i.to} {...i} />
          ))}

          {/* Central floating + button */}
          <NavLink to="/new" className="flex flex-col items-center -mt-6">
            {({ isActive }) => (
              <>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-glow-accent transition-transform ${
                    isActive ? 'bg-accent-gradient scale-110' : 'bg-accent-gradient hover:scale-105'
                  }`}
                >
                  <Plus className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
                </motion.div>
                <span className={`text-[10px] font-medium mt-1 ${isActive ? 'text-accent' : 'text-muted'}`}>Nova</span>
              </>
            )}
          </NavLink>

          {right.map((i) => (
            <NavItem key={i.to} {...i} />
          ))}

          {/* Mais button */}
          <button
            onClick={() => setMore(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 min-w-[60px] transition-colors"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  );
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors min-w-[60px] ${
          isActive ? 'text-accent' : 'text-slate-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative w-10 h-10 flex items-center justify-center">
            {isActive && (
              <motion.div
                layoutId="bottom-active-pill"
                className="absolute inset-0 bg-accent/15 rounded-2xl"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="w-5 h-5 relative z-10" />
          </div>
          <span className="relative z-10">{label}</span>
        </>
      )}
    </NavLink>
  );
}

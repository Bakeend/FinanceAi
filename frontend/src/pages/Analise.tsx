import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, BarChart3 } from 'lucide-react';
import { ComparePage } from './Compare';
import { ReportsPage } from './Reports';

const TABS = [
  { id: 'compare', label: 'Comparar', icon: ArrowLeftRight },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
];

export function AnalisePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') ?? 'compare';
  const setTab = (id: string) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Análise</span>
        </h2>
        <p className="text-muted text-sm mt-1">Compare períodos e acompanhe relatórios</p>
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex gap-1 p-1 bg-card rounded-2xl border border-border"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active === id ? 'text-accent' : 'text-muted hover:text-slate-200'
            }`}
          >
            {active === id && (
              <motion.div
                layoutId="analise-tab-pill"
                className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <Icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        ))}
      </motion.div>

      <motion.div key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {active === 'compare' && <ComparePage />}
        {active === 'reports' && <ReportsPage />}
      </motion.div>
    </div>
  );
}

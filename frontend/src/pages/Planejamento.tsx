import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, PieChart, Bell, Zap } from 'lucide-react';
import { GoalsPage } from './Goals';
import { BudgetsPage } from './Budgets';
import { RemindersPage } from './Reminders';
import { RulesPage } from './Rules';

const TABS = [
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'budgets', label: 'Orçamento', icon: PieChart },
  { id: 'reminders', label: 'Lembretes', icon: Bell },
  { id: 'rules', label: 'Regras', icon: Zap },
];

export function PlanejamentoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') ?? 'goals';
  const setTab = (id: string) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Planejamento</span>
        </h2>
        <p className="text-muted text-sm mt-1">Metas, orçamento, lembretes e regras</p>
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
                layoutId="plan-tab-pill"
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
        {active === 'goals' && <GoalsPage />}
        {active === 'budgets' && <BudgetsPage />}
        {active === 'reminders' && <RemindersPage />}
        {active === 'rules' && <RulesPage />}
      </motion.div>
    </div>
  );
}

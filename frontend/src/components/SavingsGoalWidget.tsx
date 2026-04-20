import { useState, useEffect, useRef } from 'react';
import { PiggyBank, Pencil, Check } from 'lucide-react';
import type { Summary } from '../lib/types';
import { celebrate } from '../lib/celebrate';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STORAGE_KEY = 'financeai-savings-goal';
const CELEBRATED_KEY_PREFIX = 'financeai-savings-celebrated-';

export function SavingsGoalWidget({ summary }: { summary: Summary }) {
  const [goal, setGoal] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEY) ?? 0));
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(goal)); }, [goal]);

  const savedAmount = Math.max(0, summary.saldo);
  const pct = goal > 0 ? Math.min(100, (savedAmount / goal) * 100) : 0;
  const reached = goal > 0 && savedAmount >= goal;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!reached) return;
    const monthKey = new Date().toISOString().slice(0, 7);
    const key = CELEBRATED_KEY_PREFIX + monthKey + '-' + goal;
    if (localStorage.getItem(key)) return;
    if (firedRef.current) return;
    firedRef.current = true;
    localStorage.setItem(key, '1');
    celebrate({ intensity: 'big' });
  }, [reached, goal]);

  const confirm = () => {
    const v = Number(input.replace(',', '.'));
    if (!Number.isNaN(v) && v >= 0) setGoal(v);
    setEditing(false);
  };

  if (!editing && goal === 0) {
    return (
      <button
        onClick={() => { setInput(''); setEditing(true); }}
        className="rounded-2xl border border-dashed border-border bg-card/50 p-4 flex items-center gap-3 text-muted hover:text-slate-300 hover:border-accent/40 transition-colors w-full text-left"
      >
        <PiggyBank className="w-5 h-5 shrink-0" />
        <span className="text-sm">Definir meta de economia mensal</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <span className="text-xs text-muted uppercase tracking-wider font-medium">Meta de economia</span>
        {!editing && (
          <button onClick={() => { setInput(String(goal)); setEditing(true); }} className="ml-auto text-muted hover:text-slate-200 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">R$</span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
            className="flex-1 bg-border/40 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="0,00"
          />
          <button onClick={confirm} className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-colors">
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <span className={`text-xl font-bold tabular-nums ${reached ? 'text-emerald-400' : 'text-slate-200'}`}>{fmt(savedAmount)}</span>
            <span className="text-xs text-muted">de {fmt(goal)}</span>
          </div>
          <div className="h-2 rounded-full bg-border/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-emerald-500' : pct >= 75 ? 'bg-emerald-500/80' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-muted text-right">{pct.toFixed(0)}% da meta {reached ? '🎉' : ''}</div>
        </>
      )}
    </div>
  );
}

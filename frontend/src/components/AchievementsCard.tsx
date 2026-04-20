import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award } from 'lucide-react';
import type { Summary, Transaction } from '../lib/types';
import { computeAchievements, type Achievement } from '../lib/achievements';
import { celebrate } from '../lib/celebrate';

const SEEN_KEY = 'financeai-achievements-seen';

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function writeSeen(s: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch {}
}

export function AchievementsCard({ items, summary, mes, ano }: { items: Transaction[]; summary: Summary; mes: number; ano: number }) {
  const list = useMemo(() => computeAchievements({ items, summary, mes, ano }), [items, summary, mes, ano]);
  const unlockedCount = list.filter((a) => a.unlocked).length;
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const seen = readSeen();
    const newlyUnlocked = list.filter((a) => a.unlocked && !seen.has(a.id));
    if (newlyUnlocked.length === 0) return;
    newlyUnlocked.forEach((a) => seen.add(a.id));
    writeSeen(seen);
    setTimeout(() => celebrate({ intensity: 'soft' }), 250);
  }, [list]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Award className="w-4 h-4 text-amber-400" />
        </div>
        <span className="text-xs text-muted uppercase tracking-wider font-medium">Conquistas</span>
        <span className="ml-auto text-[11px] tabular-nums text-slate-300">
          <strong className="text-amber-400">{unlockedCount}</strong>/<span>{list.length}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <AnimatePresence>
          {list.map((a, i) => (
            <Badge key={a.id} a={a} delay={i * 0.04} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Badge({ a, delay }: { a: Achievement; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      title={a.description}
      className={`relative overflow-hidden rounded-xl p-3 border ${
        a.unlocked
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-pink-500/10'
          : 'border-border bg-bg-soft opacity-60 grayscale'
      }`}
    >
      <div className="text-2xl leading-none mb-1.5">{a.emoji}</div>
      <div className={`text-[11px] font-bold leading-tight ${a.unlocked ? 'text-slate-100' : 'text-muted'}`}>
        {a.title}
      </div>
      {!a.unlocked && a.progress !== undefined && a.progress > 0 && (
        <div className="mt-1.5 h-1 rounded-full bg-card overflow-hidden">
          <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${a.progress * 100}%` }} />
        </div>
      )}
    </motion.div>
  );
}

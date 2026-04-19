import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, X } from 'lucide-react';

type UndoAction = { id: string; message: string; undo: () => Promise<void> | void; commit?: () => Promise<void> | void; expiresAt: number };

type Ctx = {
  schedule: (message: string, undo: () => Promise<void> | void, commit?: () => Promise<void> | void) => void;
};

const UndoContext = createContext<Ctx | null>(null);

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used inside UndoProvider');
  return ctx;
}

const DURATION = 6000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<UndoAction[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const schedule = useCallback((message: string, undo: () => void | Promise<void>, commit?: () => void | Promise<void>) => {
    const id = Math.random().toString(36).slice(2);
    const action: UndoAction = { id, message, undo, commit, expiresAt: Date.now() + DURATION };
    setActions((a) => [...a, action]);
    const t = setTimeout(async () => {
      if (commit) await commit();
      setActions((a) => a.filter((x) => x.id !== id));
      timeoutsRef.current.delete(id);
    }, DURATION);
    timeoutsRef.current.set(id, t);
  }, []);

  const doUndo = async (id: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;
    const t = timeoutsRef.current.get(id);
    if (t) clearTimeout(t);
    timeoutsRef.current.delete(id);
    await action.undo();
    setActions((a) => a.filter((x) => x.id !== id));
  };

  const dismiss = (id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t) clearTimeout(t);
    timeoutsRef.current.delete(id);
    const action = actions.find((a) => a.id === id);
    action?.commit?.();
    setActions((a) => a.filter((x) => x.id !== id));
  };

  useEffect(() => () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <UndoContext.Provider value={{ schedule }}>
      {children}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {actions.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="glass rounded-xl border border-border px-4 py-3 flex items-center gap-3 shadow-card pointer-events-auto min-w-[240px]"
            >
              <span className="text-sm text-slate-200 flex-1">{a.message}</span>
              <button
                onClick={() => doUndo(a.id)}
                className="flex items-center gap-1 text-accent text-xs font-semibold hover:underline"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Desfazer
              </button>
              <button onClick={() => dismiss(a.id)} className="text-muted hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </UndoContext.Provider>
  );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, LayoutDashboard } from 'lucide-react';

function greet(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function WelcomeScreen({
  name,
  onPick,
}: {
  name: string;
  onPick: (mode: 'today' | 'all') => void;
}) {
  const [show, setShow] = useState(true);
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const pick = (mode: 'today' | 'all') => {
    setShow(false);
    setTimeout(() => onPick(mode), 400);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-bg"
          style={{
            backgroundImage:
              'radial-gradient(at 30% 20%, rgba(109, 40, 217, 0.18) 0%, transparent 55%), radial-gradient(at 80% 85%, rgba(236, 72, 153, 0.12) 0%, transparent 55%)',
          }}
        >
          <div className="flex flex-col items-center gap-10 px-6 text-center max-w-lg">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="font-serif text-4xl sm:text-5xl md:text-6xl text-[#E8D8B5] leading-none tracking-tight"
              style={{ fontStyle: 'italic' }}
            >
              {greet(hour)},{' '}
              <span className="not-italic font-serif text-[#F5E8CC]">{name}</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-muted text-base"
            >
              O que você quer ver agora?
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-3 w-full"
            >
              <button
                onClick={() => pick('today')}
                className="group flex-1 flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-card-hover hover:border-accent/50 transition-all duration-150"
              >
                <Calendar className="w-5 h-5 text-accent" />
                <span className="text-slate-100 font-semibold">Ver só hoje</span>
              </button>
              <button
                onClick={() => pick('all')}
                className="group flex-1 flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl bg-accent-gradient text-slate-900 font-bold hover:bg-accent-gradient-hover transition-all duration-150 shadow-glow-accent"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Ver tudo</span>
              </button>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              onClick={() => pick('all')}
              className="text-xs text-muted hover:text-slate-300 underline underline-offset-4"
            >
              pular
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { GlobalSearchBar } from './GlobalSearchBar';
import { useKeyboardShortcuts } from '../lib/shortcuts';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  useKeyboardShortcuts(navigate);
  return (
    <div className="flex min-h-screen relative">
      {/* Ambient glow orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl animate-float" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] rounded-full bg-rose-500/5 blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <Sidebar />

      <main className="flex-1 px-4 md:px-8 py-5 pb-28 md:pb-8 overflow-x-hidden min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-w-6xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />
      <GlobalSearchBar />
    </div>
  );
}

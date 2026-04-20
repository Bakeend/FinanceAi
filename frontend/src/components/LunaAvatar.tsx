import { Moon } from 'lucide-react';

export function LunaAvatar({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iconS = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';
  return (
    <div
      className={`${s} rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow-accent ${className}`}
    >
      <Moon className={`${iconS} text-slate-900`} strokeWidth={2.2} />
    </div>
  );
}

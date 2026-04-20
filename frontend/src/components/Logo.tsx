import { useTheme } from '../lib/theme';

export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const { resolved } = useTheme();
  const src = resolved === 'retro' ? '/logo-retro.png' : '/logo.png';
  return (
    <img
      src={src}
      alt="FinanceAi"
      width={size}
      height={size}
      className={`logo-img object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function LogoWordmark({ className = '' }: { className?: string; height?: number }) {
  const { resolved } = useTheme();
  const src = resolved === 'retro' ? '/logo-retro.png' : '/logo.png';
  return (
    <img
      src={src}
      alt="FinanceAi"
      className={`logo-img block object-contain ${className}`}
    />
  );
}

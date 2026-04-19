import { categoryStyles } from '../lib/categories';

export function CategoryChip({ categoria, size = 'md' }: { categoria: string; size?: 'sm' | 'md' }) {
  const { Icon, color, bg, border } = categoryStyles(categoria);
  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${bg} ${border} ${color} ${px}`}>
      <Icon className={iconSize} />
      {categoria}
    </span>
  );
}

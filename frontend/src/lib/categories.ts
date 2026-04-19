import {
  Utensils, ShoppingCart, Car, HeartPulse, Home, Zap, Gamepad2, Plane,
  GraduationCap, ShoppingBag, Tv, Scissors, Dog, Gift, TrendingUp,
  Receipt, Briefcase, DollarSign, ArrowLeftRight, Shapes,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORIAS = [
  'Alimentação', 'Mercado', 'Transporte', 'Saúde', 'Moradia', 'Contas',
  'Lazer', 'Viagem', 'Educação', 'Compras', 'Assinaturas', 'Beleza',
  'Pets', 'Presentes', 'Investimentos', 'Impostos',
  'Salário', 'Renda extra', 'Transferência', 'Outros',
] as const;

export type Categoria = typeof CATEGORIAS[number];

export const CATEGORY_META: Record<string, { Icon: LucideIcon; color: string; bg: string; border: string }> = {
  'Alimentação':    { Icon: Utensils,      color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30' },
  'Mercado':        { Icon: ShoppingCart,  color: 'text-lime-300',    bg: 'bg-lime-500/15',    border: 'border-lime-500/30' },
  'Transporte':     { Icon: Car,           color: 'text-sky-300',     bg: 'bg-sky-500/15',     border: 'border-sky-500/30' },
  'Saúde':          { Icon: HeartPulse,    color: 'text-rose-300',    bg: 'bg-rose-500/15',    border: 'border-rose-500/30' },
  'Moradia':        { Icon: Home,          color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'Contas':         { Icon: Zap,           color: 'text-yellow-300',  bg: 'bg-yellow-500/15',  border: 'border-yellow-500/30' },
  'Lazer':          { Icon: Gamepad2,      color: 'text-violet-300',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30' },
  'Viagem':         { Icon: Plane,         color: 'text-cyan-300',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30' },
  'Educação':       { Icon: GraduationCap, color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30' },
  'Compras':        { Icon: ShoppingBag,   color: 'text-pink-300',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30' },
  'Assinaturas':    { Icon: Tv,            color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/30' },
  'Beleza':         { Icon: Scissors,      color: 'text-pink-300',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30' },
  'Pets':           { Icon: Dog,           color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30' },
  'Presentes':      { Icon: Gift,          color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/30' },
  'Investimentos':  { Icon: TrendingUp,    color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'Impostos':       { Icon: Receipt,       color: 'text-stone-300',   bg: 'bg-stone-500/15',   border: 'border-stone-500/30' },
  'Salário':        { Icon: Briefcase,     color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'Renda extra':    { Icon: DollarSign,    color: 'text-teal-300',    bg: 'bg-teal-500/15',    border: 'border-teal-500/30' },
  'Transferência':  { Icon: ArrowLeftRight, color: 'text-slate-300',  bg: 'bg-slate-500/15',   border: 'border-slate-500/30' },
  'Outros':         { Icon: Shapes,        color: 'text-slate-300',   bg: 'bg-slate-500/15',   border: 'border-slate-500/30' },
};

export function categoryStyles(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META['Outros'];
}

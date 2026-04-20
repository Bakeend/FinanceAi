import type { Transaction, Summary } from './types';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  /** Optional progress value 0..1 for locked achievements. */
  progress?: number;
};

const sameMonth = (date: string, mes: number, ano: number) => {
  const d = date.slice(0, 7);
  return d === `${ano}-${String(mes).padStart(2, '0')}`;
};

export function computeAchievements(args: {
  items: Transaction[];
  summary: Summary;
  mes: number;
  ano: number;
}): Achievement[] {
  const { items, summary, mes, ano } = args;
  const monthly = items.filter((t) => !t.isTransfer && sameMonth(t.data, mes, ano));
  const expenses = monthly.filter((t) => t.valor < 0);
  const incomes = monthly.filter((t) => t.valor > 0);

  const totalGasto = Math.abs(summary.totalGasto);
  const totalEntrada = Math.abs(summary.totalEntrada);
  const taxaPoupanca = totalEntrada > 0 ? Math.max(0, summary.saldo) / totalEntrada : 0;

  const cats = new Set(monthly.map((t) => t.categoria));
  const allWithSubcat = monthly.filter((t) => t.subcategoria && t.subcategoria.length).length;
  const taggedCount = monthly.filter((t) => (t.tags ?? []).length).length;

  const fastFood = expenses.filter((t) =>
    /(ifood|mc\s?donald|burger\s?king|kfc|subway|bk|fast\s?food|pizza)/i.test(t.descricao),
  ).length;

  // Day-streak inside this month (active days)
  const activeDays = new Set(monthly.map((t) => t.data));


  return [
    {
      id: 'first-tx',
      title: 'Primeiro lançamento',
      description: 'Você adicionou sua primeira transação',
      emoji: '🌱',
      unlocked: items.length > 0,
    },
    {
      id: 'positive-month',
      title: 'Mês no azul',
      description: 'Fechou o mês com saldo positivo',
      emoji: '💸',
      unlocked: summary.saldo > 0,
      progress: summary.saldo > 0 ? 1 : 0,
    },
    {
      id: 'savings-50',
      title: 'Poupador',
      description: 'Guardou pelo menos 50% das entradas no mês',
      emoji: '🏦',
      unlocked: taxaPoupanca >= 0.5,
      progress: Math.min(1, taxaPoupanca / 0.5),
    },
    {
      id: 'savings-30',
      title: 'Disciplinado',
      description: 'Guardou pelo menos 30% das entradas no mês',
      emoji: '🎯',
      unlocked: taxaPoupanca >= 0.3,
      progress: Math.min(1, taxaPoupanca / 0.3),
    },
    {
      id: 'no-fast-food',
      title: 'Sem fast food',
      description: 'Nenhum gasto com fast food no mês',
      emoji: '🥗',
      unlocked: monthly.length > 0 && fastFood === 0,
    },
    {
      id: 'organized',
      title: 'Organizado',
      description: 'Usou pelo menos 5 categorias diferentes',
      emoji: '🗂️',
      unlocked: cats.size >= 5,
      progress: Math.min(1, cats.size / 5),
    },
    {
      id: 'tagger',
      title: 'Tagueador',
      description: '10+ transações com tags ou subcategoria',
      emoji: '🏷️',
      unlocked: taggedCount + allWithSubcat >= 10,
      progress: Math.min(1, (taggedCount + allWithSubcat) / 10),
    },
    {
      id: 'consistent',
      title: 'Consistente',
      description: 'Registrou em 15+ dias diferentes do mês',
      emoji: '📅',
      unlocked: activeDays.size >= 15,
      progress: Math.min(1, activeDays.size / 15),
    },
    {
      id: 'income-diversity',
      title: 'Renda diversificada',
      description: '2+ entradas no mês',
      emoji: '💰',
      unlocked: incomes.length >= 2,
      progress: Math.min(1, incomes.length / 2),
    },
    {
      id: 'low-spender',
      title: 'Gasto controlado',
      description: 'Gastou menos de 70% do que entrou',
      emoji: '✨',
      unlocked: totalEntrada > 0 && totalGasto < totalEntrada * 0.7,
      progress: totalEntrada > 0 ? Math.min(1, 1 - totalGasto / (totalEntrada * 0.7)) : 0,
    },
  ];
}

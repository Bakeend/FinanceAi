export type Transaction = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  subcategoria?: string | null;
  tags?: string[];
  isTransfer?: boolean;
  accountId?: string | null;
  installmentGroup?: string | null;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  splitParentId?: string | null;
  attachment?: string | null;
};

export type AccountTipo = 'conta' | 'cartao' | 'dinheiro' | 'investimento';

export type Account = {
  id: string;
  nome: string;
  tipo: AccountTipo;
  cor: string;
  banco: string | null;
  isDefault: boolean;
  saldo: number;
  closingDay?: number | null;
  dueDay?: number | null;
  limite?: number | null;
};

export type Invoice = {
  conta: Account;
  faturaAtual: number;
  periodo: { from: string; to: string } | null;
  vencimento: string | null;
  transacoes: Transaction[];
  limiteDisponivel: number | null;
};

export type Budget = {
  id: string;
  categoria: string;
  mes: number;
  ano: number;
  valor: number;
  gasto: number;
  percentual: number;
  restante: number;
  projecao: number;
  status: 'ok' | 'alerta' | 'estourado';
  mensagem: string;
};

export type TxRule = {
  id: string;
  pattern: string;
  categoria: string;
  priority: number;
  active: boolean;
};

export type RecurringSuggestion = {
  key: string;
  descricao: string;
  categoria: string;
  mesesAtivos: number;
  valorMedio: number;
  diaTipico: number;
};

export type TodaySummary = {
  data: string;
  gastoHoje: number;
  entradaHoje: number;
  quantidadeHoje: number;
  gastoSemana: number;
  maiorGastoHoje: { id: string; descricao: string; valor: number; categoria: string } | null;
};

export type YearlyMonth = {
  mes: number;
  ano: number;
  label: string;
  totalGasto: number;
  totalEntrada: number;
  porCategoria: { categoria: string; valor: number }[];
};
export type YearlyReport = {
  ano: number;
  months: YearlyMonth[];
  totalGasto: number;
  totalEntrada: number;
  saldo: number;
  topCategorias: { categoria: string; valor: number }[];
};

export type CategoryEvolution = {
  meses: { label: string; mes: number; ano: number; porCategoria: Record<string, number> }[];
  categorias: string[];
};

export type ReceiptExtracted = {
  data: string | null;
  descricao: string;
  valor: number | null;
  categoria: string;
  estabelecimento?: string;
};

export type Trip = {
  id: string;
  nome: string;
  tag: string;
  inicio: string;
  fim: string;
  orcamento: number | null;
  cor: string;
  gastoTotal: number;
  gastoPorCategoria: { categoria: string; valor: number }[];
  transacoes: number;
  diasRestantes: number;
  status: 'futura' | 'ativa' | 'passada';
};

export type PriceIncrease = {
  descricao: string;
  categoria: string;
  anterior: number;
  atual: number;
  delta: number;
  pct: number;
  desdeQuando: string;
};

export type YearOverYear = {
  ano: number;
  mes: number;
  label: string;
  totalGasto: number;
  totalEntrada: number;
};

export type Gamification = {
  economiaVsMesAnterior: number;
  gastoAtual: number;
  gastoAnterior: number;
  streakSemComerFora: number;
  txsNoMes: number;
  dia: number;
  totalDias: number;
};

export type ForecastNext = {
  mediaGasto: number;
  mediaEntrada: number;
  proximoMes: {
    mes: number;
    ano: number;
    label: string;
    totalGasto: number;
    totalEntrada: number;
  } | null;
};
export type Summary = {
  totalGasto: number;
  totalEntrada: number;
  saldo: number;
  porCategoria: { categoria: string; total: number }[];
};
export type MonthRef = { mes: number; ano: number };

export type Goal = {
  id: string;
  categoria: string;
  valor: number;
  mes: number;
  ano: number;
  tipo: 'limite' | 'poupanca';
  gasto: number;
  percentual: number;
};

export type TrendPoint = {
  mes: number;
  ano: number;
  label: string;
  totalGasto: number;
  totalEntrada: number;
};

export type AlertItem = {
  tipo: 'aumento' | 'queda' | 'novo';
  categoria: string;
  valor: number;
  delta: number;
  pct: number;
};

export type RecurringItem = {
  descricao: string;
  categoria: string;
  mesesAtivos: number;
  valorMedio: number;
  totalGasto: number;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type BalancePoint = { date: string; saldo: number };

export type CashflowData = {
  opening: number;
  entrada: number;
  gastosPorCategoria: { categoria: string; valor: number }[];
  closing: number;
};

export type AnomalyItem = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  medianaCategoria: number;
  multiplicador: number;
};

export type YearlyProjection = {
  suficiente: boolean;
  mediaGasto: number;
  mediaEntrada: number;
  mesesRestantes: number;
  projecaoGasto: number;
  projecaoEntrada: number;
  projecaoSaldoFim: number;
};

export type Reminder = {
  id: string;
  descricao: string;
  valor: number;
  dia: number;
  categoria: string;
  accountId: string | null;
  active: boolean;
  lastPaid: string | null;
};
export type UpcomingReminder = Reminder & { diasRestantes: number };

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';

function monthRange(mes: number, ano: number): { start: string; end: string } {
  const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const endMonth = mes === 12 ? 1 : mes + 1;
  const endYear = mes === 12 ? ano + 1 : ano;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return { start, end };
}

function shiftMonth(mes: number, ano: number, delta: number): { mes: number; ano: number } {
  const total = (ano * 12 + (mes - 1)) + delta;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Month) private readonly monthRepo: Repository<Month>,
  ) {}

  async summary(mes: number, ano: number) {
    const month = await this.monthRepo.findOne({ where: { mes, ano } });
    const totalGasto = month?.totalGasto ?? 0;
    const totalEntrada = month?.totalEntrada ?? 0;
    const { start, end } = monthRange(mes, ano);
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('SUM(t.valor)', 'total')
      .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
      .groupBy('t.categoria')
      .orderBy('total', 'ASC')
      .getRawMany();
    return {
      totalGasto, totalEntrada, saldo: Number(totalEntrada) + Number(totalGasto),
      porCategoria: rows.map((r) => ({ categoria: r.categoria, total: Number(r.total) })),
    };
  }

  async months() {
    return this.monthRepo.find({ order: { ano: 'DESC', mes: 'DESC' }, select: ['mes', 'ano'] });
  }

  async trend(mes: number, ano: number, windowMonths = 6) {
    const slots = Array.from({ length: windowMonths }, (_, k) => {
      const i = windowMonths - 1 - k;
      return shiftMonth(mes, ano, -i);
    });
    return Promise.all(
      slots.map(async ({ mes: m, ano: y }) => {
        const { start, end } = monthRange(m, y);
        const row = await this.txRepo
          .createQueryBuilder('t')
          .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
          .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
          .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
          .getRawOne<{ gasto: string; entrada: string }>();
        return {
          mes: m,
          ano: y,
          label: `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`,
          totalGasto: Number(row?.gasto ?? 0),
          totalEntrada: Number(row?.entrada ?? 0),
        };
      }),
    );
  }

  async alerts(mes: number, ano: number) {
    const [current, prior] = await Promise.all([
      this.categoryTotals(mes, ano),
      (async () => {
        const { mes: pm, ano: pa } = shiftMonth(mes, ano, -1);
        return this.categoryTotals(pm, pa);
      })(),
    ]);

    // Se o mês anterior está totalmente vazio, não há base de comparação —
    // não faz sentido marcar tudo como "novo". Retorna vazio.
    const priorHasAnyData = Object.keys(prior).length > 0;
    if (!priorHasAnyData) return [];

    const alerts: { tipo: 'aumento' | 'queda' | 'novo'; categoria: string; valor: number; delta: number; pct: number }[] = [];
    for (const [cat, val] of Object.entries(current)) {
      const prev = prior[cat] ?? 0;
      if (prev === 0 && val > 50) {
        alerts.push({ tipo: 'novo', categoria: cat, valor: val, delta: val, pct: 100 });
      } else if (prev > 0) {
        const delta = val - prev;
        const pct = (delta / prev) * 100;
        if (pct >= 30 && delta > 20) alerts.push({ tipo: 'aumento', categoria: cat, valor: val, delta, pct });
        else if (pct <= -30 && Math.abs(delta) > 20) alerts.push({ tipo: 'queda', categoria: cat, valor: val, delta, pct });
      }
    }
    return alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
  }

  /** Cumulative balance by day since first transaction (or from-to) */
  async balanceTimeline(from?: string, to?: string) {
    let qb = this.txRepo.createQueryBuilder('t').andWhere('t.is_transfer = 0');
    if (from) qb = qb.andWhere('t.data >= :from', { from });
    if (to) qb = qb.andWhere('t.data <= :to', { to });
    const all = await qb.orderBy('t.data', 'ASC').getMany();
    if (!all.length) return [];
    const byDay = new Map<string, number>();
    for (const t of all) byDay.set(t.data, (byDay.get(t.data) ?? 0) + t.valor);
    const sorted = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    let running = 0;
    return sorted.map(([date, delta]) => {
      running += delta;
      return { date, saldo: running };
    });
  }

  async cashflow(mes: number, ano: number) {
    const { start, end } = monthRange(mes, ano);
    // Opening balance = sum of all transactions before start
    const openingRow = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'soma')
      .where('t.data < :start AND t.is_transfer = 0', { start })
      .getRawOne<{ soma: string }>();
    const opening = Number(openingRow?.soma ?? 0);

    const entradas = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'soma')
      .where('t.data >= :start AND t.data < :end AND t.valor > 0 AND t.is_transfer = 0', { start, end })
      .getRawOne<{ soma: string }>();
    const entrada = Number(entradas?.soma ?? 0);

    const byCat = await this.txRepo.createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('COALESCE(SUM(-t.valor), 0)', 'gasto')
      .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
      .groupBy('t.categoria')
      .orderBy('gasto', 'DESC')
      .getRawMany<{ categoria: string; gasto: string }>();

    const gastosPorCategoria = byCat.map((r) => ({ categoria: r.categoria, valor: Number(r.gasto) }));
    const totalGasto = gastosPorCategoria.reduce((s, g) => s + g.valor, 0);
    const closing = opening + entrada - totalGasto;

    return { opening, entrada, gastosPorCategoria, closing };
  }

  /** Anomalias: transações que ultrapassam 3x a mediana da sua categoria no mês */
  async anomalies(mes: number, ano: number) {
    const { start, end } = monthRange(mes, ano);
    const all = await this.txRepo.createQueryBuilder('t')
      .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
      .getMany();
    const byCat = new Map<string, number[]>();
    for (const t of all) {
      const key = t.categoria;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(Math.abs(t.valor));
    }
    const medians = new Map<string, number>();
    for (const [cat, vals] of byCat) {
      if (vals.length < 3) continue;
      const sorted = [...vals].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      medians.set(cat, med);
    }
    const out: { id: string; data: string; descricao: string; valor: number; categoria: string; medianaCategoria: number; multiplicador: number }[] = [];
    for (const t of all) {
      const med = medians.get(t.categoria);
      if (!med || med === 0) continue;
      const mult = Math.abs(t.valor) / med;
      if (mult >= 3) {
        out.push({
          id: t.id,
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          categoria: t.categoria,
          medianaCategoria: med,
          multiplicador: mult,
        });
      }
    }
    return out.sort((a, b) => b.multiplicador - a.multiplicador).slice(0, 10);
  }

  /** Projeção até o fim do ano com base na média mensal observada */
  async yearlyProjection(mes: number, ano: number) {
    const history: { mes: number; ano: number; gasto: number; entrada: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const { mes: m, ano: y } = shiftMonth(mes, ano, -i);
      const { start, end } = monthRange(m, y);
      const row = await this.txRepo.createQueryBuilder('t')
        .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
        .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
        .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
        .getRawOne<{ gasto: string; entrada: string }>();
      history.push({ mes: m, ano: y, gasto: Number(row?.gasto ?? 0), entrada: Number(row?.entrada ?? 0) });
    }
    const validos = history.filter((h) => h.gasto > 0 || h.entrada > 0);
    if (validos.length < 2) {
      return { suficiente: false, mediaGasto: 0, mediaEntrada: 0, mesesRestantes: 0, projecaoGasto: 0, projecaoEntrada: 0, projecaoSaldoFim: 0 };
    }
    const mediaGasto = validos.reduce((s, h) => s + h.gasto, 0) / validos.length;
    const mediaEntrada = validos.reduce((s, h) => s + h.entrada, 0) / validos.length;
    // meses restantes no ano (inclusive o atual em andamento? — vou contar de mes+1 até dezembro)
    const mesesRestantes = Math.max(0, 12 - mes);
    const projecaoGasto = mediaGasto * mesesRestantes;
    const projecaoEntrada = mediaEntrada * mesesRestantes;
    // Saldo acumulado até fim de mes atual:
    const openingRow = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'soma')
      .where('t.data <= :end AND t.is_transfer = 0', { end: monthRange(mes, ano).end })
      .getRawOne<{ soma: string }>();
    const saldoAteFimMes = Number(openingRow?.soma ?? 0);
    const projecaoSaldoFim = saldoAteFimMes - projecaoGasto + projecaoEntrada;
    return { suficiente: true, mediaGasto, mediaEntrada, mesesRestantes, projecaoGasto, projecaoEntrada, projecaoSaldoFim };
  }

  /** Sugestões de recorrências para o usuário confirmar — inclui dia típico do mês e valor médio. */
  async recurringSuggestions(minMonths = 3) {
    const all = await this.txRepo.find({ order: { data: 'ASC' } });
    type Group = { key: string; sample: string; categoria: string; entries: { data: string; valor: number }[]; months: Set<string>; dias: number[] };
    const groups = new Map<string, Group>();
    for (const t of all) {
      if (t.valor >= 0) continue;
      if (t.isTransfer) continue;
      const key = this.normalizeDesc(t.descricao);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = { key, sample: t.descricao, categoria: t.categoria, entries: [], months: new Set(), dias: [] };
        groups.set(key, g);
      }
      g.entries.push({ data: t.data, valor: t.valor });
      g.months.add(t.data.slice(0, 7));
      g.dias.push(Number(t.data.slice(8, 10)));
    }
    return Array.from(groups.values())
      .filter((g) => g.months.size >= minMonths)
      .map((g) => {
        const sortedDias = [...g.dias].sort((a, b) => a - b);
        const diaTipico = sortedDias[Math.floor(sortedDias.length / 2)];
        const valorMedio = g.entries.reduce((s, e) => s + e.valor, 0) / g.entries.length;
        return {
          key: g.key,
          descricao: g.sample,
          categoria: g.categoria,
          mesesAtivos: g.months.size,
          valorMedio,
          diaTipico,
        };
      })
      .sort((a, b) => a.valorMedio - b.valorMedio);
  }

  async recurring(minMonths = 3, limit = 200) {
    const all = await this.txRepo.find({ order: { data: 'ASC' } });
    const cap = Math.max(1, Math.min(limit, 500));
    type Group = { key: string; sample: string; categoria: string; entries: { data: string; valor: number }[]; months: Set<string> };
    const groups = new Map<string, Group>();
    for (const t of all) {
      if (t.valor >= 0) continue;
      const key = this.normalizeDesc(t.descricao);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = { key, sample: t.descricao, categoria: t.categoria, entries: [], months: new Set() };
        groups.set(key, g);
      }
      g.entries.push({ data: t.data, valor: t.valor });
      g.months.add(t.data.slice(0, 7));
    }
    const result = Array.from(groups.values())
      .filter((g) => g.months.size >= minMonths)
      .map((g) => ({
        descricao: g.sample,
        categoria: g.categoria,
        mesesAtivos: g.months.size,
        valorMedio: g.entries.reduce((s, e) => s + e.valor, 0) / g.entries.length,
        totalGasto: g.entries.reduce((s, e) => s + e.valor, 0),
      }))
      .sort((a, b) => a.valorMedio - b.valorMedio)
      .slice(0, cap);
    return result;
  }

  private async categoryTotals(mes: number, ano: number): Promise<Record<string, number>> {
    const { start, end } = monthRange(mes, ano);
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('SUM(-t.valor)', 'gasto')
      .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
      .groupBy('t.categoria')
      .getRawMany<{ categoria: string; gasto: string }>();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.categoria] = Number(r.gasto);
    return out;
  }

  /** Ano x Ano: mesmo mês em anos diferentes */
  async yearOverYear(mes: number, ano: number, years = 3) {
    const out: { ano: number; mes: number; label: string; totalGasto: number; totalEntrada: number }[] = [];
    for (let k = years - 1; k >= 0; k--) {
      const y = ano - k;
      const { start, end } = monthRange(mes, y);
      const row = await this.txRepo.createQueryBuilder('t')
        .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
        .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
        .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
        .getRawOne<{ gasto: string; entrada: string }>();
      out.push({
        ano: y, mes,
        label: `${String(mes).padStart(2, '0')}/${y}`,
        totalGasto: Number(row?.gasto ?? 0),
        totalEntrada: Number(row?.entrada ?? 0),
      });
    }
    return out;
  }

  /** Detecta aumentos em gastos recorrentes (ex: Netflix subiu). */
  async priceIncreases() {
    const all = await this.txRepo.find({ order: { data: 'ASC' } });
    type Group = { sample: string; categoria: string; entries: { data: string; valor: number }[] };
    const groups = new Map<string, Group>();
    for (const t of all) {
      if (t.valor >= 0 || t.isTransfer) continue;
      const key = this.normalizeDesc(t.descricao);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) { g = { sample: t.descricao, categoria: t.categoria, entries: [] }; groups.set(key, g); }
      g.entries.push({ data: t.data, valor: Math.abs(t.valor) });
    }
    const out: { descricao: string; categoria: string; anterior: number; atual: number; delta: number; pct: number; desdeQuando: string }[] = [];
    for (const g of groups.values()) {
      if (g.entries.length < 4) continue;
      const sorted = [...g.entries].sort((a, b) => (a.data < b.data ? -1 : 1));
      const last2 = sorted.slice(-2);
      const prior = sorted.slice(0, -2);
      if (!prior.length) continue;
      const priorAvg = prior.reduce((s, e) => s + e.valor, 0) / prior.length;
      const currAvg = last2.reduce((s, e) => s + e.valor, 0) / last2.length;
      if (priorAvg === 0) continue;
      const pct = ((currAvg - priorAvg) / priorAvg) * 100;
      const delta = currAvg - priorAvg;
      if (pct >= 15 && delta >= 5) {
        out.push({ descricao: g.sample, categoria: g.categoria, anterior: priorAvg, atual: currAvg, delta, pct, desdeQuando: last2[0].data });
      }
    }
    return out.sort((a, b) => b.pct - a.pct).slice(0, 5);
  }

  /** Gamificação: streaks + economia do mês vs anterior */
  async gamification() {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const mes = today.getMonth() + 1;
    const ano = today.getFullYear();
    const prev = shiftMonth(mes, ano, -1);

    const [curr, prior] = await Promise.all([
      this.monthRepo.findOne({ where: { mes, ano } }),
      this.monthRepo.findOne({ where: { mes: prev.mes, ano: prev.ano } }),
    ]);
    const gastoAtual = Math.abs(curr?.totalGasto ?? 0);
    const gastoAnterior = Math.abs(prior?.totalGasto ?? 0);
    const dia = today.getDate();
    const totalDias = new Date(ano, mes, 0).getDate();
    const economiaEsperada = gastoAnterior > 0 ? (gastoAnterior * dia / totalDias) - gastoAtual : 0;

    // Streak: dias consecutivos até hoje sem gastos em "Alimentação" fora de casa
    const txs = await this.txRepo.createQueryBuilder('t')
      .where("t.data <= :d AND t.valor < 0 AND t.categoria = 'Alimentação' AND t.is_transfer = 0", { d: todayIso })
      .orderBy('t.data', 'DESC')
      .limit(365)
      .getMany();
    let streakSemComerFora = 0;
    if (!txs.length) {
      streakSemComerFora = 365;
    } else {
      const lastFood = txs[0].data;
      streakSemComerFora = Math.max(0, Math.floor((new Date(todayIso).getTime() - new Date(lastFood).getTime()) / 86400000));
    }

    // Total de transações lançadas no mês
    const { start, end } = monthRange(mes, ano);
    const countRow = await this.txRepo.createQueryBuilder('t')
      .select('COUNT(*)', 'c')
      .where('t.data >= :start AND t.data < :end', { start, end })
      .getRawOne<{ c: string }>();

    return {
      economiaVsMesAnterior: economiaEsperada,
      gastoAtual, gastoAnterior,
      streakSemComerFora,
      txsNoMes: Number(countRow?.c ?? 0),
      dia, totalDias,
    };
  }

  /** Previsão: projeta próximo mês baseado na média móvel dos últimos N */
  async forecastNext(mes: number, ano: number, windowMonths = 6) {
    const slots = Array.from({ length: windowMonths }, (_, k) => shiftMonth(mes, ano, -k));
    let sumGasto = 0, sumEntrada = 0, n = 0;
    for (const { mes: m, ano: y } of slots) {
      const { start, end } = monthRange(m, y);
      const row = await this.txRepo.createQueryBuilder('t')
        .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
        .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
        .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
        .getRawOne<{ gasto: string; entrada: string }>();
      const g = Number(row?.gasto ?? 0);
      const e = Number(row?.entrada ?? 0);
      if (g > 0 || e > 0) {
        sumGasto += g; sumEntrada += e; n++;
      }
    }
    if (n === 0) return { mediaGasto: 0, mediaEntrada: 0, proximoMes: null };
    const next = shiftMonth(mes, ano, 1);
    return {
      mediaGasto: sumGasto / n,
      mediaEntrada: sumEntrada / n,
      proximoMes: {
        mes: next.mes,
        ano: next.ano,
        label: `${String(next.mes).padStart(2, '0')}/${String(next.ano).slice(-2)}`,
        totalGasto: sumGasto / n,
        totalEntrada: sumEntrada / n,
      },
    };
  }

  async today() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const rowToday = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
      .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
      .addSelect('COUNT(*)', 'qtd')
      .where('t.data = :d AND t.is_transfer = 0', { d: today })
      .getRawOne<{ gasto: string; entrada: string; qtd: string }>();
    const rowWeek = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
      .where('t.data >= :from AND t.data <= :to AND t.is_transfer = 0', { from: weekStartIso, to: today })
      .getRawOne<{ gasto: string }>();
    const maiorHoje = await this.txRepo.createQueryBuilder('t')
      .where('t.data = :d AND t.valor < 0 AND t.is_transfer = 0', { d: today })
      .orderBy('t.valor', 'ASC')
      .limit(1)
      .getOne();
    return {
      data: today,
      gastoHoje: Number(rowToday?.gasto ?? 0),
      entradaHoje: Number(rowToday?.entrada ?? 0),
      quantidadeHoje: Number(rowToday?.qtd ?? 0),
      gastoSemana: Number(rowWeek?.gasto ?? 0),
      maiorGastoHoje: maiorHoje
        ? { id: maiorHoje.id, descricao: maiorHoje.descricao, valor: maiorHoje.valor, categoria: maiorHoje.categoria }
        : null,
    };
  }

  /** Relatório anual consolidado: 12 meses de um ano */
  async yearly(ano: number) {
    const months = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const mes = i + 1;
        const { start, end } = monthRange(mes, ano);
        const row = await this.txRepo.createQueryBuilder('t')
          .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
          .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
          .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0', { start, end })
          .getRawOne<{ gasto: string; entrada: string }>();
        const cats = await this.txRepo.createQueryBuilder('t')
          .select('t.categoria', 'categoria')
          .addSelect('COALESCE(SUM(-t.valor), 0)', 'valor')
          .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
          .groupBy('t.categoria')
          .getRawMany<{ categoria: string; valor: string }>();
        return {
          mes,
          ano,
          label: `${String(mes).padStart(2, '0')}/${String(ano).slice(-2)}`,
          totalGasto: Number(row?.gasto ?? 0),
          totalEntrada: Number(row?.entrada ?? 0),
          porCategoria: cats.map((c) => ({ categoria: c.categoria, valor: Number(c.valor) })),
        };
      }),
    );
    const totalGasto = months.reduce((s, m) => s + m.totalGasto, 0);
    const totalEntrada = months.reduce((s, m) => s + m.totalEntrada, 0);
    const byCat = new Map<string, number>();
    for (const m of months) for (const c of m.porCategoria) byCat.set(c.categoria, (byCat.get(c.categoria) ?? 0) + c.valor);
    const topCategorias = Array.from(byCat.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    return { ano, months, totalGasto, totalEntrada, saldo: totalEntrada - totalGasto, topCategorias };
  }

  /** Evolução histórica por categoria — últimos N meses */
  async categoryEvolution(mes: number, ano: number, months = 12) {
    const slots = Array.from({ length: months }, (_, k) => {
      const i = months - 1 - k;
      return shiftMonth(mes, ano, -i);
    });
    const result: { label: string; mes: number; ano: number; porCategoria: Record<string, number> }[] = [];
    for (const { mes: m, ano: y } of slots) {
      const { start, end } = monthRange(m, y);
      const rows = await this.txRepo.createQueryBuilder('t')
        .select('t.categoria', 'categoria')
        .addSelect('COALESCE(SUM(-t.valor), 0)', 'valor')
        .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0', { start, end })
        .groupBy('t.categoria')
        .getRawMany<{ categoria: string; valor: string }>();
      const porCategoria: Record<string, number> = {};
      for (const r of rows) porCategoria[r.categoria] = Number(r.valor);
      result.push({ label: `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`, mes: m, ano: y, porCategoria });
    }
    const allCats = new Set<string>();
    for (const r of result) for (const k of Object.keys(r.porCategoria)) allCats.add(k);
    const totals = new Map<string, number>();
    for (const r of result) for (const [k, v] of Object.entries(r.porCategoria)) totals.set(k, (totals.get(k) ?? 0) + v);
    const categorias = Array.from(allCats).sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    return { meses: result, categorias };
  }

  private normalizeDesc(desc: string): string {
    return desc
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\d+[,.]?\d*/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4)
      .join(' ');
  }
}

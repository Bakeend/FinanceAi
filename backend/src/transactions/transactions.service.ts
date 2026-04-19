import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { RawTransaction } from './parsers/types';
import { RulesService } from '../rules/rules.module';
import { Trip } from '../trips/trip.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Month) private readonly monthRepo: Repository<Month>,
    @Optional() private readonly rules?: RulesService,
    @Optional() @InjectRepository(Trip) private readonly tripRepo?: Repository<Trip>,
  ) {}

  async createMany(
    rows: (RawTransaction & { categoria?: string; attachment?: string | null; accountId?: string | null })[],
    userId: string,
  ) {
    if (rows.length === 0) return { saved: [], skipped: 0 };

    const dates = rows.map((r) => r.data);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const existing = await this.txRepo
      .createQueryBuilder('t')
      .where('t.data >= :min AND t.data <= :max AND t.user_id = :uid', { min: minDate, max: maxDate, uid: userId })
      .getMany();

    const seen = new Set(existing.map((t) => this.signature(t.data, t.descricao, t.valor)));
    const localSeen = new Set<string>();
    const toInsert: (RawTransaction & { categoria: string; userId: string })[] = [];
    let skipped = 0;

    const activeRules = this.rules ? await this.rules.loadActive(userId) : [];
    const trips = this.tripRepo
      ? await this.tripRepo.createQueryBuilder('t')
          .where('t.inicio <= :max AND t.fim >= :min AND t.user_id = :uid', { min: minDate, max: maxDate, uid: userId })
          .getMany()
      : [];
    for (const r of rows) {
      const sig = this.signature(r.data, r.descricao, r.valor);
      if (seen.has(sig) || localSeen.has(sig)) {
        skipped++;
        continue;
      }
      localSeen.add(sig);
      let categoria = r.categoria ?? 'Outros';
      if (activeRules.length && (categoria === 'Outros' || categoria == null)) {
        const match = activeRules.find((rule) => this.rules!.matches(r.descricao, rule.pattern));
        if (match) categoria = match.categoria;
      }
      const tripTags = trips.filter((t) => r.data >= t.inicio && r.data <= t.fim).map((t) => t.tag);
      const tags = tripTags.length ? [...((r as any).tags ?? []), ...tripTags] : ((r as any).tags ?? undefined);
      toInsert.push({ ...r, categoria, userId, ...(tags ? { tags } : {}) });
    }

    if (toInsert.length === 0) return { saved: [], skipped };

    const saved = await this.txRepo.save(toInsert);
    await this.detectTransfers(saved.map((t) => t.id), userId);
    const monthsTouched = new Set<string>();
    for (const t of saved) monthsTouched.add(t.data.slice(0, 7));
    for (const ym of monthsTouched) {
      const [y, m] = ym.split('-');
      await this.recomputeMonth(Number(m), Number(y), userId);
    }
    return { saved, skipped };
  }

  private async detectTransfers(newIds: string[], userId: string) {
    if (!newIds.length) return;
    const news = await this.txRepo.createQueryBuilder('t')
      .where('t.id IN (:...ids) AND t.user_id = :uid', { ids: newIds, uid: userId })
      .getMany();
    for (const n of news) {
      if (n.isTransfer) continue;
      const isSelfPix = /pix.*voc[eê]|para voc[eê] mesmo|mesma titularidade|entre contas/i.test(n.descricao);
      if (isSelfPix) {
        await this.txRepo.update(n.id, { isTransfer: true });
        continue;
      }
      const signed = -n.valor;
      const dateFrom = this.addDays(n.data, -3);
      const dateTo = this.addDays(n.data, 3);
      const match = await this.txRepo.createQueryBuilder('t')
        .where('t.id != :id AND t.data >= :from AND t.data <= :to AND t.valor = :v AND t.is_transfer = 0 AND t.user_id = :uid', {
          id: n.id, from: dateFrom, to: dateTo, v: signed, uid: userId,
        })
        .getOne();
      if (match) {
        const desc1 = this.normalizeForMatch(n.descricao);
        const desc2 = this.normalizeForMatch(match.descricao);
        const tokens1 = new Set(desc1.split(' ').filter((w) => w.length > 3));
        const tokens2 = desc2.split(' ').filter((w) => w.length > 3);
        const common = tokens2.filter((t) => tokens1.has(t)).length;
        if (common >= 2) {
          await this.txRepo.update(n.id, { isTransfer: true });
          await this.txRepo.update(match.id, { isTransfer: true });
        }
      }
    }
  }

  private addDays(iso: string, delta: number): string {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  private normalizeForMatch(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async bulkUpdate(
    ids: string[],
    patch: Partial<{ categoria: string; tags: string[]; isTransfer: boolean }>,
    userId: string,
  ) {
    if (!ids.length) return { updated: 0 };
    const txs = await this.txRepo.createQueryBuilder('t').where('t.id IN (:...ids) AND t.user_id = :uid', { ids, uid: userId }).getMany();
    if (!txs.length) return { updated: 0 };
    await this.txRepo.update(txs.map((t) => t.id), patch);
    const monthsTouched = new Set<string>();
    for (const t of txs) monthsTouched.add(t.data.slice(0, 7));
    for (const ym of monthsTouched) {
      const [y, m] = ym.split('-');
      await this.recomputeMonth(Number(m), Number(y), userId);
    }
    return { updated: txs.length };
  }

  async bulkRemove(ids: string[], userId: string) {
    if (!ids.length) return { removed: 0 };
    const txs = await this.txRepo.createQueryBuilder('t').where('t.id IN (:...ids) AND t.user_id = :uid', { ids, uid: userId }).getMany();
    if (!txs.length) return { removed: 0 };
    await this.txRepo.delete(txs.map((t) => t.id));
    const monthsTouched = new Set<string>();
    for (const t of txs) monthsTouched.add(t.data.slice(0, 7));
    for (const ym of monthsTouched) {
      const [y, m] = ym.split('-');
      await this.recomputeMonth(Number(m), Number(y), userId);
    }
    return { removed: txs.length };
  }

  async suggestTags(id: string, userId: string): Promise<string[]> {
    const tx = await this.txRepo.findOne({ where: { id, userId } });
    if (!tx) return [];
    const tokens = this.normalizeForMatch(tx.descricao).split(' ').filter((w) => w.length > 3);
    if (!tokens.length) return [];
    const similar = await this.txRepo
      .createQueryBuilder('t')
      .where('t.id != :id', { id })
      .andWhere('t.user_id = :uid', { uid: userId })
      .andWhere('t.tags IS NOT NULL')
      .andWhere("t.tags != '[]' AND t.tags != ''")
      .andWhere(`(${tokens.map((_, i) => `LOWER(t.descricao) LIKE :t${i}`).join(' OR ')})`, Object.fromEntries(tokens.map((t, i) => [`t${i}`, `%${t}%`])))
      .take(20)
      .getMany();
    const freq = new Map<string, number>();
    for (const s of similar) {
      for (const tag of s.tags ?? []) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .filter(([tag]) => !(tx.tags ?? []).includes(tag))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  private signature(data: string, descricao: string, valor: number): string {
    const normDesc = descricao.trim().toLowerCase().replace(/\s+/g, ' ');
    const cents = Math.round(valor * 100);
    return `${data}|${normDesc}|${cents}`;
  }

  async findAll(userId: string, limit?: number) {
    const qb = this.txRepo.createQueryBuilder('t').where('t.user_id = :uid', { uid: userId }).orderBy('t.data', 'ASC');
    if (typeof limit === 'number' && limit > 0) qb.take(Math.min(limit, 10000));
    return qb.getMany();
  }

  async findFiltered(
    userId: string,
    filters: {
      mes?: number;
      ano?: number;
      categoria?: string;
      q?: string;
      tipo?: 'entrada' | 'gasto' | 'all';
      accountId?: string;
    },
  ) {
    let qb = this.txRepo.createQueryBuilder('t').where('t.user_id = :uid', { uid: userId });
    if (filters.mes && filters.ano) {
      const start = `${filters.ano}-${String(filters.mes).padStart(2, '0')}-01`;
      const endMonth = filters.mes === 12 ? 1 : filters.mes + 1;
      const endYear = filters.mes === 12 ? filters.ano + 1 : filters.ano;
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      qb = qb.andWhere('t.data >= :start AND t.data < :end', { start, end });
    }
    if (filters.categoria) qb = qb.andWhere('t.categoria = :cat', { cat: filters.categoria });
    if (filters.q) qb = qb.andWhere('LOWER(t.descricao) LIKE :q', { q: `%${filters.q.toLowerCase()}%` });
    if (filters.tipo === 'entrada') qb = qb.andWhere('t.valor > 0');
    if (filters.tipo === 'gasto') qb = qb.andWhere('t.valor < 0');
    if (filters.accountId) qb = qb.andWhere('t.account_id = :aid', { aid: filters.accountId });
    return qb.orderBy('t.data', 'DESC').addOrderBy('t.created_at', 'DESC').getMany();
  }

  async findByMonth(mes: number, ano: number, userId: string) {
    return this.findFiltered(userId, { mes, ano });
  }

  async updateCategoria(id: string, categoria: string, userId: string) {
    return this.updateOne(id, { categoria }, userId);
  }

  async updateOne(
    id: string,
    patch: Partial<Pick<Transaction, 'data' | 'descricao' | 'valor' | 'categoria' | 'subcategoria' | 'accountId' | 'attachment'>> & { tags?: string[] },
    userId: string,
    options: { applyToInstallments?: boolean } = {},
  ) {
    const before = await this.txRepo.findOne({ where: { id, userId } });
    if (!before) return null;
    await this.txRepo.update(id, patch as any);
    const monthsToRecompute = new Set<string>();
    monthsToRecompute.add(before.data.slice(0, 7));

    if (options.applyToInstallments && before.installmentGroup) {
      const rest = { ...patch } as any;
      delete rest.valor;
      delete rest.data;
      if (Object.keys(rest).length) {
        const siblings = await this.txRepo.createQueryBuilder('t')
          .where('t.installment_group = :g AND t.id != :id AND t.user_id = :uid', { g: before.installmentGroup, id, uid: userId })
          .getMany();
        for (const s of siblings) {
          await this.txRepo.update(s.id, rest);
          monthsToRecompute.add(s.data.slice(0, 7));
        }
      }
    }

    const after = await this.txRepo.findOne({ where: { id, userId } });
    if (after) monthsToRecompute.add(after.data.slice(0, 7));
    for (const ym of monthsToRecompute) {
      const [y, m] = ym.split('-');
      await this.recomputeMonth(Number(m), Number(y), userId);
    }
    return after;
  }

  async createInstallments(args: {
    data: string;
    descricao: string;
    valorTotal: number;
    parcelas: number;
    categoria?: string;
    accountId?: string | null;
  }, userId: string) {
    const group = (globalThis.crypto?.randomUUID?.() ?? `inst-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const perParcel = Math.round((args.valorTotal / args.parcelas) * 100) / 100;
    const rows: Partial<Transaction>[] = [];
    for (let i = 1; i <= args.parcelas; i++) {
      rows.push({
        data: this.addMonths(args.data, i - 1),
        descricao: `${args.descricao} (${i}/${args.parcelas})`,
        valor: perParcel,
        categoria: args.categoria ?? 'Outros',
        accountId: args.accountId ?? null,
        installmentGroup: group,
        installmentNum: i,
        installmentTotal: args.parcelas,
        userId,
      });
    }
    const saved = await this.txRepo.save(rows);
    const monthsTouched = new Set<string>();
    for (const t of saved) monthsTouched.add(t.data.slice(0, 7));
    for (const ym of monthsTouched) {
      const [y, m] = ym.split('-');
      await this.recomputeMonth(Number(m), Number(y), userId);
    }
    return saved;
  }

  async splitTransaction(id: string, items: { valor: number; categoria: string; descricao?: string }[], userId: string) {
    const parent = await this.txRepo.findOne({ where: { id, userId } });
    if (!parent) return null;
    const soma = items.reduce((s, i) => s + i.valor, 0);
    const diff = Math.abs(soma - parent.valor);
    if (diff > 0.01) {
      throw new Error(`Soma dos splits (${soma.toFixed(2)}) não bate com valor original (${parent.valor.toFixed(2)})`);
    }
    const rows = items.map((i) => ({
      data: parent.data,
      descricao: i.descricao ?? parent.descricao,
      valor: i.valor,
      categoria: i.categoria,
      accountId: parent.accountId,
      splitParentId: parent.id,
      tags: parent.tags,
      userId,
    }));
    const saved = await this.txRepo.save(rows as any);
    await this.txRepo.delete(parent.id);
    const [y, m] = parent.data.split('-');
    await this.recomputeMonth(Number(m), Number(y), userId);
    return saved;
  }

  private addMonths(iso: string, delta: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCMonth(date.getUTCMonth() + delta);
    return date.toISOString().slice(0, 10);
  }

  async createTransfer(args: {
    data: string;
    valor: number;
    fromAccountId: string;
    toAccountId: string;
    descricao?: string;
  }, userId: string) {
    if (args.fromAccountId === args.toAccountId) {
      throw new Error('Origem e destino precisam ser contas diferentes');
    }
    if (args.valor <= 0) {
      throw new Error('Valor da transferência deve ser positivo');
    }
    const pairId = globalThis.crypto?.randomUUID?.() ?? `tr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const desc = (args.descricao?.trim() || 'Transferência entre contas');
    const rows: Partial<Transaction>[] = [
      {
        data: args.data,
        descricao: `${desc} (saída)`,
        valor: -Math.abs(args.valor),
        categoria: 'Transferência',
        accountId: args.fromAccountId,
        isTransfer: true,
        transferPairId: pairId,
        userId,
      },
      {
        data: args.data,
        descricao: `${desc} (entrada)`,
        valor: Math.abs(args.valor),
        categoria: 'Transferência',
        accountId: args.toAccountId,
        isTransfer: true,
        transferPairId: pairId,
        userId,
      },
    ];
    const saved = await this.txRepo.save(rows);
    const [y, m] = args.data.split('-');
    await this.recomputeMonth(Number(m), Number(y), userId);
    return saved;
  }

  async remove(id: string, userId: string) {
    const tx = await this.txRepo.findOne({ where: { id, userId } });
    if (!tx) return;
    await this.txRepo.delete(id);
    const [y, m] = tx.data.split('-');
    await this.recomputeMonth(Number(m), Number(y), userId);
  }

  async recomputeMonth(mes: number, ano: number, userId: string) {
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endMonth = mes === 12 ? 1 : mes + 1;
    const endYear = mes === 12 ? ano + 1 : ano;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    const row = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN t.valor ELSE 0 END), 0)', 'gasto')
      .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
      .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0 AND t.user_id = :uid', { start, end, uid: userId })
      .getRawOne<{ gasto: string; entrada: string }>();
    await this.monthRepo.upsert(
      { mes, ano, userId, totalGasto: Number(row?.gasto ?? 0), totalEntrada: Number(row?.entrada ?? 0) },
      ['mes', 'ano', 'userId'],
    );
  }
}

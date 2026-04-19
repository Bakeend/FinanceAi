# Multi-User Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope every database query to the authenticated user's ID so users never see each other's data.

**Architecture:** Add a `user_id` column to every data-bearing table via a single migration. Pass `userId` down from every controller (via `@CurrentUser()`) to every service method, and add `.where('t.user_id = :uid', { uid: userId })` to every query. No new abstractions — just surgical additions to existing files.

**Tech Stack:** NestJS, TypeORM, SQLite, class-validator

---

## File Map

| File | Change |
|------|--------|
| `backend/src/database/migrations/1776950000000-MultiUser.ts` | **CREATE** — adds user_id to all tables |
| `backend/src/transactions/entities/transaction.entity.ts` | Add `userId` column |
| `backend/src/transactions/entities/month.entity.ts` | Add `userId` column + update @Unique |
| `backend/src/transactions/entities/goal.entity.ts` | Add `userId` column + update @Unique |
| `backend/src/accounts/account.entity.ts` | Add `userId` column |
| `backend/src/budgets/budget.entity.ts` | Add `userId` column |
| `backend/src/rules/rule.entity.ts` | Add `userId` column |
| `backend/src/reminders/reminder.entity.ts` | Add `userId` column |
| `backend/src/trips/trip.entity.ts` | Add `userId` column |
| `backend/src/ai/chat-message.entity.ts` | Add `userId` column |
| `backend/src/ai/memory.entity.ts` | Replace integer `id` with text `userId` as PK |
| `backend/src/transactions/transactions.service.ts` | All methods get `userId: string` param |
| `backend/src/transactions/transactions.controller.ts` | All endpoints extract `@CurrentUser()` |
| `backend/src/dashboard/dashboard.service.ts` | All methods get `userId: string` param |
| `backend/src/dashboard/dashboard.controller.ts` | Extract `@CurrentUser()` |
| `backend/src/accounts/accounts.module.ts` | Service methods + controller get userId |
| `backend/src/budgets/budgets.module.ts` | Service methods + controller get userId |
| `backend/src/goals/goals.service.ts` | Service methods get userId |
| `backend/src/goals/goals.controller.ts` | Controller extracts `@CurrentUser()` |
| `backend/src/rules/rules.module.ts` | Service methods + controller get userId |
| `backend/src/reminders/reminders.module.ts` | Service methods + controller get userId |
| `backend/src/trips/trips.module.ts` | Service methods + controller get userId |
| `backend/src/ai/ai.service.ts` | `getMemory`/`setMemory` take userId |
| `backend/src/ai/ai.controller.ts` | All endpoints extract `@CurrentUser()` |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/src/database/migrations/1776950000000-MultiUser.ts`

- [ ] **Step 1: Create the migration file**

```typescript
// backend/src/database/migrations/1776950000000-MultiUser.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiUser1776950000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Add user_id to simple tables (ALTER TABLE ADD COLUMN is safe in SQLite)
    const simpleTables = ['transactions', 'accounts', 'budgets', 'rules', 'reminders', 'trips', 'chat_messages'];
    for (const t of simpleTables) {
      await q.query(`ALTER TABLE ${t} ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
    }

    // Populate user_id from first user for all existing rows
    for (const t of simpleTables) {
      await q.query(`UPDATE ${t} SET user_id = COALESCE((SELECT id FROM users LIMIT 1), '') WHERE user_id = ''`);
      await q.query(`CREATE INDEX IF NOT EXISTS idx_${t}_user_id ON ${t}(user_id)`);
    }

    // Recreate months table (need to change UNIQUE constraint to include user_id)
    await q.query(`
      CREATE TABLE months_new (
        id          TEXT PRIMARY KEY,
        mes         INTEGER NOT NULL,
        ano         INTEGER NOT NULL,
        total_gasto NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_entrada NUMERIC(12,2) NOT NULL DEFAULT 0,
        user_id     TEXT NOT NULL DEFAULT '',
        UNIQUE(mes, ano, user_id)
      )
    `);
    await q.query(`INSERT INTO months_new SELECT id, mes, ano, total_gasto, total_entrada, COALESCE((SELECT id FROM users LIMIT 1), '') FROM months`);
    await q.query(`DROP TABLE months`);
    await q.query(`ALTER TABLE months_new RENAME TO months`);

    // Recreate goals table (UNIQUE was categoria+mes+ano, now add user_id)
    await q.query(`
      CREATE TABLE goals_new (
        id          TEXT PRIMARY KEY,
        categoria   VARCHAR(32) NOT NULL,
        valor       NUMERIC(12,2) NOT NULL,
        mes         INTEGER NOT NULL,
        ano         INTEGER NOT NULL,
        tipo        VARCHAR(16) NOT NULL DEFAULT 'limite',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        user_id     TEXT NOT NULL DEFAULT '',
        UNIQUE(categoria, mes, ano, user_id)
      )
    `);
    await q.query(`INSERT INTO goals_new SELECT id, categoria, valor, mes, ano, tipo, created_at, COALESCE((SELECT id FROM users LIMIT 1), '') FROM goals`);
    await q.query(`DROP TABLE goals`);
    await q.query(`ALTER TABLE goals_new RENAME TO goals`);

    // Recreate ai_memory with user_id as primary key (was integer id=1)
    await q.query(`
      CREATE TABLE ai_memory_new (
        user_id    TEXT PRIMARY KEY,
        content    TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`
      INSERT OR IGNORE INTO ai_memory_new
      SELECT COALESCE((SELECT id FROM users LIMIT 1), 'default'), content, updated_at
      FROM ai_memory WHERE id = 1
    `);
    await q.query(`DROP TABLE ai_memory`);
    await q.query(`ALTER TABLE ai_memory_new RENAME TO ai_memory`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Reverse is destructive — just drop user_id columns
    // SQLite doesn't support DROP COLUMN in older versions; skip for brevity
    throw new Error('Down migration not supported for multi-user isolation');
  }
}
```

- [ ] **Step 2: Verify the migration file was created**

```bash
ls backend/src/database/migrations/
```
Expected: file `1776950000000-MultiUser.ts` present.

---

## Task 2: Update Entities

**Files:**
- Modify: `backend/src/transactions/entities/transaction.entity.ts`
- Modify: `backend/src/transactions/entities/month.entity.ts`
- Modify: `backend/src/transactions/entities/goal.entity.ts`
- Modify: `backend/src/accounts/account.entity.ts`
- Modify: `backend/src/budgets/budget.entity.ts`
- Modify: `backend/src/rules/rule.entity.ts`
- Modify: `backend/src/reminders/reminder.entity.ts`
- Modify: `backend/src/trips/trip.entity.ts`
- Modify: `backend/src/ai/chat-message.entity.ts`
- Modify: `backend/src/ai/memory.entity.ts`

- [ ] **Step 1: Add userId to Transaction entity**

In `backend/src/transactions/entities/transaction.entity.ts`, add after the last `@Index()` column and before `@CreateDateColumn`:

```typescript
@Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
```

- [ ] **Step 2: Update Month entity — add userId and fix @Unique**

Replace the class decorator line in `backend/src/transactions/entities/month.entity.ts`:
```typescript
// Before:
@Entity('months')
@Unique(['mes', 'ano'])
export class Month {

// After:
@Entity('months')
@Unique(['mes', 'ano', 'userId'])
export class Month {
```
And add the column before the closing brace:
```typescript
@Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
```

- [ ] **Step 3: Update Goal entity — add userId and fix @Unique**

```typescript
// Before:
@Entity('goals')
@Unique(['categoria', 'mes', 'ano'])
export class Goal {

// After:
@Entity('goals')
@Unique(['categoria', 'mes', 'ano', 'userId'])
export class Goal {
```
Add column:
```typescript
@Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
```

- [ ] **Step 4: Add userId to Account, Budget, TxRule, Reminder, Trip, ChatMessage**

In each entity file, add this line inside the class body (before `@CreateDateColumn` where present):
```typescript
@Index() @Column({ type: 'text', name: 'user_id', default: '' }) userId: string;
```
Files:
- `backend/src/accounts/account.entity.ts`
- `backend/src/budgets/budget.entity.ts`
- `backend/src/rules/rule.entity.ts`
- `backend/src/reminders/reminder.entity.ts`
- `backend/src/trips/trip.entity.ts`
- `backend/src/ai/chat-message.entity.ts`

- [ ] **Step 5: Update AiMemory entity — replace integer id with userId PK**

Replace entire `backend/src/ai/memory.entity.ts`:
```typescript
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_memory')
export class AiMemoryEntity {
  @PrimaryColumn({ type: 'text', name: 'user_id' }) userId: string;
  @Column({ type: 'text', default: '' }) content: string;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

---

## Task 3: Update TransactionsService

**Files:**
- Modify: `backend/src/transactions/transactions.service.ts`

Every method that queries the database needs a `userId: string` parameter. Note: `RulesService.loadActive` and the trip repo query inside `createMany` also need userId — those are addressed in Tasks 6 and 7.

- [ ] **Step 1: Update `createMany` signature and queries**

```typescript
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
  const trips = this.tripRepo ? await this.tripRepo.createQueryBuilder('t')
    .where('t.inicio <= :max AND t.fim >= :min AND t.user_id = :uid', { min: minDate, max: maxDate, uid: userId })
    .getMany() : [];

  for (const r of rows) {
    const sig = this.signature(r.data, r.descricao, r.valor);
    if (seen.has(sig) || localSeen.has(sig)) { skipped++; continue; }
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
```

- [ ] **Step 2: Update `detectTransfers` to scope by userId**

```typescript
private async detectTransfers(newIds: string[], userId: string) {
  if (!newIds.length) return;
  const news = await this.txRepo.createQueryBuilder('t')
    .where('t.id IN (:...ids) AND t.user_id = :uid', { ids: newIds, uid: userId })
    .getMany();
  for (const n of news) {
    if (n.isTransfer) continue;
    const isSelfPix = /pix.*voc[eê]|para voc[eê] mesmo|mesma titularidade|entre contas/i.test(n.descricao);
    if (isSelfPix) { await this.txRepo.update(n.id, { isTransfer: true }); continue; }
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
```

- [ ] **Step 3: Update `findAll`, `findFiltered`, `findByMonth`**

```typescript
async findAll(limit?: number, userId?: string) {
  const qb = this.txRepo.createQueryBuilder('t').orderBy('t.data', 'ASC');
  if (userId) qb.where('t.user_id = :uid', { uid: userId });
  if (typeof limit === 'number' && limit > 0) qb.take(Math.min(limit, 10000));
  return qb.getMany();
}

async findFiltered(
  filters: { mes?: number; ano?: number; categoria?: string; q?: string; tipo?: 'entrada' | 'gasto' | 'all'; accountId?: string },
  userId?: string,
) {
  let qb = this.txRepo.createQueryBuilder('t');
  if (userId) qb = qb.where('t.user_id = :uid', { uid: userId });
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

async findByMonth(mes: number, ano: number, userId?: string) {
  return this.findFiltered({ mes, ano }, userId);
}
```

- [ ] **Step 4: Update `bulkUpdate`, `bulkRemove`, `updateOne`, `remove`**

```typescript
async bulkUpdate(ids: string[], patch: Partial<{ categoria: string; tags: string[]; isTransfer: boolean }>, userId: string) {
  if (!ids.length) return { updated: 0 };
  const txs = await this.txRepo.createQueryBuilder('t')
    .where('t.id IN (:...ids) AND t.user_id = :uid', { ids, uid: userId })
    .getMany();
  if (!txs.length) return { updated: 0 };
  await this.txRepo.update(ids, patch);
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
  const txs = await this.txRepo.createQueryBuilder('t')
    .where('t.id IN (:...ids) AND t.user_id = :uid', { ids, uid: userId })
    .getMany();
  if (!txs.length) return { removed: 0 };
  await this.txRepo.delete(ids);
  const monthsTouched = new Set<string>();
  for (const t of txs) monthsTouched.add(t.data.slice(0, 7));
  for (const ym of monthsTouched) {
    const [y, m] = ym.split('-');
    await this.recomputeMonth(Number(m), Number(y), userId);
  }
  return { removed: txs.length };
}

async updateOne(
  id: string,
  patch: Partial<Pick<Transaction, 'data' | 'descricao' | 'valor' | 'categoria' | 'accountId' | 'attachment'>> & { tags?: string[] },
  options: { applyToInstallments?: boolean } = {},
  userId?: string,
) {
  const where: any = { id };
  const before = await this.txRepo.findOne({ where });
  if (!before) return null;
  await this.txRepo.update(id, patch as any);
  const monthsToRecompute = new Set<string>();
  monthsToRecompute.add(before.data.slice(0, 7));
  if (options.applyToInstallments && before.installmentGroup) {
    const updatable = { ...patch as any };
    delete updatable.valor; delete updatable.data;
    if (Object.keys(updatable).length) {
      const siblings = await this.txRepo.createQueryBuilder('t')
        .where('t.installment_group = :g AND t.id != :id', { g: before.installmentGroup, id })
        .getMany();
      for (const s of siblings) {
        await this.txRepo.update(s.id, updatable);
        monthsToRecompute.add(s.data.slice(0, 7));
      }
    }
  }
  const after = await this.txRepo.findOne({ where: { id } });
  if (after) monthsToRecompute.add(after.data.slice(0, 7));
  for (const ym of monthsToRecompute) {
    const [y, m] = ym.split('-');
    await this.recomputeMonth(Number(m), Number(y), userId ?? before.userId);
  }
  return after;
}

async remove(id: string, userId?: string) {
  const tx = await this.txRepo.findOne({ where: { id } });
  if (!tx) return;
  await this.txRepo.delete(id);
  const [y, m] = tx.data.split('-');
  await this.recomputeMonth(Number(m), Number(y), userId ?? tx.userId);
}
```

- [ ] **Step 5: Update `recomputeMonth` to scope by userId**

```typescript
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
```

- [ ] **Step 6: Update `createInstallments`, `splitTransaction`, `createTransfer`, `suggestTags`**

```typescript
async createInstallments(args: {
  data: string; descricao: string; valorTotal: number; parcelas: number;
  categoria?: string; accountId?: string | null; userId: string;
}) {
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
      userId: args.userId,
    });
  }
  const saved = await this.txRepo.save(rows);
  const monthsTouched = new Set<string>();
  for (const t of saved) monthsTouched.add(t.data.slice(0, 7));
  for (const ym of monthsTouched) {
    const [y, m] = ym.split('-');
    await this.recomputeMonth(Number(m), Number(y), args.userId);
  }
  return saved;
}

async splitTransaction(id: string, items: { valor: number; categoria: string; descricao?: string }[], userId?: string) {
  const parent = await this.txRepo.findOne({ where: { id } });
  if (!parent) return null;
  const soma = items.reduce((s, i) => s + i.valor, 0);
  const diff = Math.abs(soma - parent.valor);
  if (diff > 0.01) throw new Error(`Soma dos splits (${soma.toFixed(2)}) não bate com valor original (${parent.valor.toFixed(2)})`);
  const rows = items.map((i) => ({
    data: parent.data, descricao: i.descricao ?? parent.descricao,
    valor: i.valor, categoria: i.categoria,
    accountId: parent.accountId, splitParentId: parent.id,
    tags: parent.tags, userId: userId ?? parent.userId,
  }));
  const saved = await this.txRepo.save(rows as any);
  await this.txRepo.delete(parent.id);
  const [y, m] = parent.data.split('-');
  await this.recomputeMonth(Number(m), Number(y), userId ?? parent.userId);
  return saved;
}

async createTransfer(args: {
  data: string; valor: number; fromAccountId: string; toAccountId: string;
  descricao?: string; userId: string;
}) {
  if (args.fromAccountId === args.toAccountId) throw new Error('Origem e destino precisam ser contas diferentes');
  if (args.valor <= 0) throw new Error('Valor da transferência deve ser positivo');
  const pairId = globalThis.crypto?.randomUUID?.() ?? `tr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const desc = (args.descricao?.trim() || 'Transferência entre contas');
  const rows: Partial<Transaction>[] = [
    { data: args.data, descricao: `${desc} (saída)`, valor: -Math.abs(args.valor), categoria: 'Transferência', accountId: args.fromAccountId, isTransfer: true, transferPairId: pairId, userId: args.userId },
    { data: args.data, descricao: `${desc} (entrada)`, valor: Math.abs(args.valor), categoria: 'Transferência', accountId: args.toAccountId, isTransfer: true, transferPairId: pairId, userId: args.userId },
  ];
  const saved = await this.txRepo.save(rows);
  const [y, m] = args.data.split('-');
  await this.recomputeMonth(Number(m), Number(y), args.userId);
  return saved;
}

async suggestTags(id: string, userId?: string): Promise<string[]> {
  const tx = await this.txRepo.findOne({ where: { id } });
  if (!tx) return [];
  const tokens = this.normalizeForMatch(tx.descricao).split(' ').filter((w) => w.length > 3);
  if (!tokens.length) return [];
  const qb = this.txRepo.createQueryBuilder('t')
    .where('t.id != :id', { id })
    .andWhere('t.tags IS NOT NULL')
    .andWhere("t.tags != '[]' AND t.tags != ''")
    .andWhere(`(${tokens.map((_, i) => `LOWER(t.descricao) LIKE :t${i}`).join(' OR ')})`, Object.fromEntries(tokens.map((t, i) => [`t${i}`, `%${t}%`])));
  if (userId) qb.andWhere('t.user_id = :uid', { uid: userId });
  const similar = await qb.take(20).getMany();
  const freq = new Map<string, number>();
  for (const s of similar) for (const tag of s.tags ?? []) freq.set(tag, (freq.get(tag) ?? 0) + 1);
  return Array.from(freq.entries())
    .filter(([tag]) => !(tx.tags ?? []).includes(tag))
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag);
}
```

---

## Task 4: Update TransactionsController

**Files:**
- Modify: `backend/src/transactions/transactions.controller.ts`

- [ ] **Step 1: Import CurrentUser**

Add `CurrentUser` to the import from `'../auth/auth.module'`:
```typescript
import { CurrentUser } from '../auth/auth.module';
```

- [ ] **Step 2: Add `@CurrentUser() u: any` to every endpoint and pass `u.id`**

Replace entire controller class body with this (imports stay the same):

```typescript
@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(
    private readonly txs: TransactionsService,
    private readonly csv: CsvParser,
    private readonly pdf: PdfParser,
    private readonly ofx: OfxParser,
    private readonly ai: AiService,
  ) {}

  private detectKind(file: Express.Multer.File): 'csv' | 'pdf' | 'ofx' {
    const n = file.originalname.toLowerCase();
    if (n.endsWith('.ofx') || n.endsWith('.qfx') || file.mimetype.includes('ofx')) return 'ofx';
    if (file.mimetype.includes('csv') || n.endsWith('.csv')) return 'csv';
    if (file.mimetype === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    throw new BadRequestException('Apenas .csv, .pdf ou .ofx');
  }

  private async parseFile(file: Express.Multer.File) {
    const kind = this.detectKind(file);
    if (kind === 'csv') return this.csv.parse(file.buffer);
    if (kind === 'ofx') return this.ofx.parse(file.buffer);
    return this.pdf.parse(file.buffer);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: any) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    const raw = await this.parseFile(file);
    let cats: { index: number; categoria: string }[] = [];
    let aiWarning: string | null = null;
    try { cats = await this.ai.categorizeBatch(raw); } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — transações salvas como "Outros".';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — transações salvas como "Outros".';
      else aiWarning = 'Categorização indisponível — transações salvas como "Outros".';
      this.logger.warn(`IA falhou no upload: ${(e as Error).message}`);
    }
    const enriched = raw.map((r, i) => ({ ...r, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' }));
    const { saved, skipped } = await this.txs.createMany(enriched, u.id);
    return { count: saved.length, skipped, transactions: saved, aiWarning };
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    const raw = await this.parseFile(file);
    let cats: { index: number; categoria: string }[] = [];
    let aiWarning: string | null = null;
    try { cats = await this.ai.categorizeBatch(raw); } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — categorize manualmente antes de confirmar.';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — sugeridas como "Outros".';
      else aiWarning = 'Categorização indisponível — sugeridas como "Outros".';
    }
    const items = raw.map((r, i) => ({ ...r, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' }));
    return { items, aiWarning };
  }

  @Post('confirm')
  async confirm(@Body() body: ConfirmTransactionsDto, @CurrentUser() u: any) {
    const { saved, skipped } = await this.txs.createMany(body.items, u.id);
    return { count: saved.length, skipped, transactions: saved };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financeai-export.csv"')
  async export(@Res() res: Response, @CurrentUser() u: any) {
    const all = await this.txs.findAll(undefined, u.id);
    const header = 'data,descricao,valor,categoria,tags,created_at\n';
    const escape = (s: string) => { const str = String(s ?? ''); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    const body = all.map((t) => [t.data, escape(t.descricao), t.valor.toFixed(2), t.categoria, escape((t.tags ?? []).join('|')), t.createdAt?.toISOString?.() ?? ''].join(',')).join('\n');
    res.send(header + body + '\n');
  }

  @Get('export-xls')
  @Header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financeai-export.xls"')
  async exportXls(@Res() res: Response, @CurrentUser() u: any) {
    const all = await this.txs.findAll(undefined, u.id);
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = all.map((t) => `<tr><td>${t.data}</td><td>${esc(t.descricao)}</td><td>${t.valor.toFixed(2)}</td><td>${esc(t.categoria)}</td><td>${esc(t.subcategoria ?? '')}</td><td>${esc((t.tags ?? []).join('|'))}</td></tr>`).join('');
    const byCategoria: Record<string, number> = {};
    for (const t of all) if (t.valor < 0) byCategoria[t.categoria] = (byCategoria[t.categoria] ?? 0) + (-t.valor);
    const catRows = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.toFixed(2)}</td></tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Transacoes</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet><x:ExcelWorksheet><x:Name>Categorias</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml></head><body><table border="1"><caption>Transacoes</caption><tr><th>Data</th><th>Descricao</th><th>Valor</th><th>Categoria</th><th>Subcategoria</th><th>Tags</th></tr>${rows}</table><br/><table border="1"><caption>Categorias</caption><tr><th>Categoria</th><th>Total gasto</th></tr>${catRows}</table></body></html>`;
    res.send(html);
  }

  @Post('recategorize')
  async recategorize(@Body() body: RecategorizeDto = {}, @CurrentUser() u: any) {
    const all = body.mes && body.ano
      ? await this.txs.findByMonth(body.mes, body.ano, u.id)
      : await this.txs.findAll(2000, u.id);
    if (!all.length) return { updated: 0, total: 0 };
    const CHUNK = 50;
    let updated = 0;
    for (let offset = 0; offset < all.length; offset += CHUNK) {
      const slice = all.slice(offset, offset + CHUNK);
      let cats: { index: number; categoria: string }[] = [];
      try { cats = await this.ai.categorizeBatch(slice.map((t) => ({ data: t.data, descricao: t.descricao, valor: t.valor }))); } catch (e) {
        this.logger.warn(`Recategorização falhou no bloco ${offset}: ${(e as Error).message}`);
        continue;
      }
      for (let i = 0; i < slice.length; i++) {
        const cat = cats.find((c) => c.index === i)?.categoria;
        if (cat && cat !== slice[i].categoria) { await this.txs.updateOne(slice[i].id, { categoria: cat }, {}, u.id); updated++; }
      }
    }
    return { updated, total: all.length };
  }

  @Post()
  async createOne(@Body() dto: CreateTransactionDto, @CurrentUser() u: any) {
    if (dto.installments && dto.installments > 1) {
      const created = await this.txs.createInstallments({
        data: dto.data, descricao: dto.descricao, valorTotal: dto.valor,
        parcelas: dto.installments, categoria: dto.categoria, accountId: dto.accountId, userId: u.id,
      });
      return { saved: created[0] ?? null, skipped: 0, installments: created.length };
    }
    const { saved, skipped } = await this.txs.createMany([{ ...dto, categoria: dto.categoria ?? 'Outros' } as any], u.id);
    return { saved: saved[0] ?? null, skipped };
  }

  @Post('transfer')
  async transfer(@Body() body: { data: string; valor: number; fromAccountId: string; toAccountId: string; descricao?: string }, @CurrentUser() u: any) {
    if (!body?.data || !body?.fromAccountId || !body?.toAccountId || typeof body?.valor !== 'number') {
      throw new BadRequestException('Campos obrigatórios: data, valor, fromAccountId, toAccountId');
    }
    try { return { saved: await this.txs.createTransfer({ ...body, userId: u.id }) }; } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('ocr-receipt')
  async ocrReceipt(@Body() body: { imageDataUrl: string }) {
    if (!body?.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) throw new BadRequestException('imageDataUrl deve ser data URL de imagem');
    try { return await this.ai.ocrReceipt(body.imageDataUrl); } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      this.logger.warn(`OCR falhou: ${(e as Error).message}`);
      throw new BadRequestException('Não foi possível ler o recibo. Tente outra foto ou digite manualmente.');
    }
  }

  @Post('ocr-screenshot')
  async ocrScreenshot(@Body() body: { imageDataUrl: string }) {
    if (!body?.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) throw new BadRequestException('imageDataUrl deve ser data URL de imagem');
    try {
      const items = await this.ai.ocrMultiReceipt(body.imageDataUrl);
      let cats: { index: number; categoria: string }[] = [];
      if (items.length) { try { cats = await this.ai.categorizeBatch(items); } catch { /* fallback */ } }
      return { items: items.map((it, i) => ({ ...it, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' })) };
    } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      throw new BadRequestException('Não foi possível ler o screenshot.');
    }
  }

  @Post('paste-text')
  async pasteText(@Body() body: { text: string }) {
    if (!body?.text || body.text.trim().length < 10) throw new BadRequestException('Cole o texto de um e-mail ou NF-e (pelo menos 10 caracteres).');
    try {
      const raw = await this.ai.extractTransactions(body.text);
      let cats: { index: number; categoria: string }[] = [];
      if (raw.length) { try { cats = await this.ai.categorizeBatch(raw); } catch { /* fallback */ } }
      return { items: raw.map((it, i) => ({ ...it, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' })) };
    } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      throw new BadRequestException('Não foi possível extrair transações desse texto.');
    }
  }

  @Post('upload-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Arquivo precisa ser uma imagem (JPEG, PNG, WebP).');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    let aiWarning: string | null = null;
    let extracted: Awaited<ReturnType<AiService['ocrReceipt']>> = { data: null, descricao: file.originalname || 'Comprovante', valor: null, categoria: 'Outros' };
    try { extracted = await this.ai.ocrReceipt(dataUrl); } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — preencha os dados manualmente.';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — preencha os dados manualmente.';
      else aiWarning = 'Não foi possível ler o recibo. Preencha os dados manualmente.';
      this.logger.warn(`OCR upload falhou: ${(e as Error).message}`);
    }
    const today = new Date().toISOString().slice(0, 10);
    return { item: { data: extracted.data ?? today, descricao: extracted.estabelecimento ? `${extracted.estabelecimento} — ${extracted.descricao}`.slice(0, 100) : extracted.descricao, valor: extracted.valor ?? 0, categoria: extracted.categoria, attachment: dataUrl }, aiWarning };
  }

  @Post(':id/split')
  async split(@Param('id') id: string, @Body() body: { items: { valor: number; categoria: string; descricao?: string }[] }, @CurrentUser() u: any) {
    const saved = await this.txs.splitTransaction(id, body?.items ?? [], u.id);
    if (!saved) throw new NotFoundException('Transação não encontrada');
    return { items: saved };
  }

  @Get()
  list(
    @Query('mes') mes?: string, @Query('ano') ano?: string,
    @Query('categoria') categoria?: string, @Query('q') q?: string,
    @Query('tipo') tipo?: 'entrada' | 'gasto' | 'all', @Query('accountId') accountId?: string,
    @CurrentUser() u?: any,
  ) {
    return this.txs.findFiltered({ mes: mes ? Number(mes) : undefined, ano: ano ? Number(ano) : undefined, categoria, q, tipo, accountId }, u?.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @CurrentUser() u: any) {
    const { applyToInstallments, ...patch } = dto;
    const updated = await this.txs.updateOne(id, patch as any, { applyToInstallments }, u.id);
    if (!updated) throw new NotFoundException('Transação não encontrada');
    return updated;
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() u: any) {
    await this.txs.remove(id, u.id);
    return { ok: true };
  }

  @Patch('bulk/update')
  bulkUpdate(@Body() body: { ids: string[]; categoria?: string; tags?: string[]; isTransfer?: boolean }, @CurrentUser() u: any) {
    const { ids, ...patch } = body ?? { ids: [] };
    return this.txs.bulkUpdate(ids ?? [], patch, u.id);
  }

  @Post('bulk/delete')
  bulkDelete(@Body() body: { ids: string[] }, @CurrentUser() u: any) {
    return this.txs.bulkRemove(body?.ids ?? [], u.id);
  }

  @Get(':id/tag-suggestions')
  suggestTags(@Param('id') id: string, @CurrentUser() u: any) {
    return this.txs.suggestTags(id, u?.id).then((tags) => ({ tags }));
  }
}
```

---

## Task 5: Update DashboardService + Controller

**Files:**
- Modify: `backend/src/dashboard/dashboard.service.ts`
- Modify: `backend/src/dashboard/dashboard.controller.ts`

- [ ] **Step 1: Add `userId` param to every DashboardService method**

Every method in `dashboard.service.ts` that queries `txRepo` or `monthRepo` needs a `userId: string` parameter and must add `.andWhere('t.user_id = :uid', { uid: userId })` (for txRepo queries) or `{ where: { mes, ano, userId } }` (for monthRepo).

Key changes:
- `summary(mes, ano, userId)`: add `userId` to monthRepo.findOne where clause, add userId filter to the txRepo queryBuilder
- `months(userId)`: `this.monthRepo.find({ where: { userId }, order: {...} })`
- `trend(mes, ano, windowMonths, userId)`: add userId filter to every txRepo query inside
- All other methods that have txRepo queries: add `AND t.user_id = :uid` to where clauses
- `recomputeMonth` is on TransactionsService (already updated), not DashboardService

Full updated `summary` method as example:
```typescript
async summary(mes: number, ano: number, userId: string) {
  const month = await this.monthRepo.findOne({ where: { mes, ano, userId } });
  const totalGasto = month?.totalGasto ?? 0;
  const totalEntrada = month?.totalEntrada ?? 0;
  const { start, end } = monthRange(mes, ano);
  const rows = await this.txRepo
    .createQueryBuilder('t')
    .select('t.categoria', 'categoria')
    .addSelect('SUM(t.valor)', 'total')
    .where('t.data >= :start AND t.data < :end AND t.valor < 0 AND t.is_transfer = 0 AND t.user_id = :uid', { start, end, uid: userId })
    .groupBy('t.categoria')
    .orderBy('total', 'ASC')
    .getRawMany();
  return {
    totalGasto, totalEntrada, saldo: Number(totalEntrada) + Number(totalGasto),
    porCategoria: rows.map((r) => ({ categoria: r.categoria, total: Number(r.total) })),
  };
}

async months(userId: string) {
  return this.monthRepo.find({ where: { userId }, order: { ano: 'DESC', mes: 'DESC' }, select: ['mes', 'ano'] });
}
```

Apply the same pattern (`AND t.user_id = :uid`) to every other `txRepo.createQueryBuilder` call in the file, and `{ userId }` to every `monthRepo.findOne`/`monthRepo.find` call.

- [ ] **Step 2: Update DashboardController to extract CurrentUser and pass userId**

```typescript
import { CurrentUser } from '../auth/auth.module';
```

Add `@CurrentUser() u: any` to every controller method and pass `u.id` to the corresponding service method. Example:

```typescript
@Get('summary')
summary(@Query('mes') mes: string, @Query('ano') ano: string, @CurrentUser() u: any) {
  return this.svc.summary(Number(mes), Number(ano), u.id);
}

@Get('months')
months(@CurrentUser() u: any) {
  return this.svc.months(u.id);
}
```
Apply to all endpoints in `dashboard.controller.ts`.

---

## Task 6: Update AccountsService, BudgetsService, GoalsService, RulesService, RemindersService, TripsService

**Files:**
- Modify: `backend/src/accounts/accounts.module.ts`
- Modify: `backend/src/budgets/budgets.module.ts`
- Modify: `backend/src/goals/goals.service.ts`
- Modify: `backend/src/goals/goals.controller.ts`
- Modify: `backend/src/rules/rules.module.ts`
- Modify: `backend/src/reminders/reminders.module.ts`
- Modify: `backend/src/trips/trips.module.ts`

- [ ] **Step 1: AccountsService — scope to userId**

```typescript
async list(userId: string) {
  const all = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  const results = await Promise.all(all.map(async (a) => {
    const row = await this.txRepo.createQueryBuilder('t')
      .select('COALESCE(SUM(t.valor), 0)', 'saldo')
      .where('t.account_id = :id AND t.is_transfer = 0 AND t.user_id = :uid', { id: a.id, uid: userId })
      .getRawOne<{ saldo: string }>();
    return { ...a, saldo: Number(row?.saldo ?? 0) };
  }));
  return results;
}

async invoice(accountId: string, userId: string) {
  const acc = await this.repo.findOne({ where: { id: accountId, userId } });
  if (!acc) throw new NotFoundException('Conta não encontrada');
  // rest of method unchanged except txRepo query adds: AND t.user_id = :uid
  const txs = await this.txRepo.createQueryBuilder('t')
    .where('t.account_id = :id AND t.data >= :from AND t.data <= :to AND t.user_id = :uid', {
      id: accountId, from: periodo.from, to: periodo.to, uid: userId,
    }).orderBy('t.data', 'ASC').getMany();
  // ... rest unchanged
}

create(dto: CreateAccountDto, userId: string) {
  return this.repo.save(this.repo.create({ ...dto, cor: dto.cor ?? '#38bdf8', userId } as any));
}

async update(id: string, dto: UpdateAccountDto, userId: string) {
  await this.repo.update({ id, userId }, dto as any);
  return this.repo.findOne({ where: { id, userId } });
}

async remove(id: string, userId: string) {
  const acc = await this.repo.findOne({ where: { id, userId } });
  if (!acc) throw new NotFoundException('Conta não encontrada');
  if (acc.isDefault) throw new NotFoundException('Conta padrão não pode ser excluída');
  await this.repo.delete(id);
}
```

AccountsController — add `@CurrentUser() u: any` and import CurrentUser:
```typescript
import { CurrentUser } from '../auth/auth.module';
// ...
@Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
@Post() create(@Body() dto: CreateAccountDto, @CurrentUser() u: any) { return this.svc.create(dto, u.id); }
@Get(':id/invoice') invoice(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.invoice(id, u.id); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
```

- [ ] **Step 2: BudgetsService — scope to userId**

```typescript
async list(mes: number, ano: number, userId: string): Promise<BudgetProgress[]> {
  const budgets = await this.repo.find({ where: { mes, ano, userId } });
  if (!budgets.length) return [];
  const { start, end } = monthRange(mes, ano);
  const rows = await this.txRepo.createQueryBuilder('t')
    .select('t.categoria', 'categoria')
    .addSelect('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
    .where('t.data >= :start AND t.data < :end AND t.is_transfer = 0 AND t.user_id = :uid', { start, end, uid: userId })
    .groupBy('t.categoria')
    .getRawMany<{ categoria: string; gasto: string }>();
  // rest unchanged
}

async create(dto: CreateBudgetDto, userId: string) {
  return this.repo.save(this.repo.create({ ...dto, userId } as any));
}

async update(id: string, dto: UpdateBudgetDto, userId: string) {
  await this.repo.update({ id, userId }, dto as any);
  return this.repo.findOne({ where: { id } });
}

async remove(id: string, userId: string) {
  const b = await this.repo.findOne({ where: { id, userId } });
  if (!b) throw new NotFoundException('Orçamento não encontrado');
  await this.repo.delete(id);
}

async copyFromPreviousMonth(mes: number, ano: number, userId: string) {
  const prevMes = mes === 1 ? 12 : mes - 1;
  const prevAno = mes === 1 ? ano - 1 : ano;
  const prev = await this.repo.find({ where: { mes: prevMes, ano: prevAno, userId } });
  if (!prev.length) return { copied: 0 };
  const existing = await this.repo.find({ where: { mes, ano, userId } });
  const existingCats = new Set(existing.map((e) => e.categoria));
  const toInsert = prev.filter((p) => !existingCats.has(p.categoria)).map((p) => ({ categoria: p.categoria, valor: p.valor, mes, ano, userId }));
  if (toInsert.length) await this.repo.save(toInsert as any);
  return { copied: toInsert.length };
}
```

BudgetsController:
```typescript
import { CurrentUser } from '../auth/auth.module';
// ...
@Get() list(@Query('mes') mes?: string, @Query('ano') ano?: string, @CurrentUser() u?: any) {
  const m = Number(mes ?? new Date().getMonth() + 1);
  const a = Number(ano ?? new Date().getFullYear());
  return this.svc.list(m, a, u!.id);
}
@Post() create(@Body() dto: CreateBudgetDto, @CurrentUser() u: any) { return this.svc.create(dto, u.id); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
@Post('copy-previous') async copy(@Body() body: { mes: number; ano: number }, @CurrentUser() u: any) {
  return this.svc.copyFromPreviousMonth(body.mes, body.ano, u.id);
}
```

- [ ] **Step 3: GoalsService — scope to userId**

```typescript
async list(mes: number, ano: number, userId: string): Promise<GoalProgress[]> {
  const goals = await this.goalRepo.find({ where: { mes, ano, userId } });
  if (!goals.length) return [];
  // ... txRepo query adds AND t.user_id = :uid
  const rows = await this.txRepo.createQueryBuilder('t')
    .select('t.categoria', 'categoria')
    .addSelect('COALESCE(SUM(CASE WHEN t.valor < 0 THEN -t.valor ELSE 0 END), 0)', 'gasto')
    .where('t.data >= :start AND t.data < :end AND t.user_id = :uid', { start, end, uid: userId })
    .groupBy('t.categoria')
    .getRawMany<{ categoria: string; gasto: string }>();
  // rest unchanged
}

create(dto: { categoria: string; valor: number; mes: number; ano: number; tipo?: 'limite' | 'poupanca'; userId: string }) {
  return this.goalRepo.save(this.goalRepo.create({ ...dto, tipo: dto.tipo ?? 'limite' }));
}

async update(id: string, patch: Partial<{ valor: number; categoria: string; tipo: 'limite' | 'poupanca' }>, userId: string) {
  await this.goalRepo.update({ id, userId }, patch);
  return this.goalRepo.findOne({ where: { id } });
}

async remove(id: string, userId: string) {
  await this.goalRepo.delete({ id, userId });
}
```

GoalsController (`backend/src/goals/goals.controller.ts`):
```typescript
import { CurrentUser } from '../auth/auth.module';
// In every method add @CurrentUser() u: any and pass u.id
@Get() list(@Query('mes') mes?: string, @Query('ano') ano?: string, @CurrentUser() u?: any) {
  const m = Number(mes ?? new Date().getMonth() + 1);
  const a = Number(ano ?? new Date().getFullYear());
  return this.svc.list(m, a, u!.id);
}
@Post() create(@Body() dto: any, @CurrentUser() u: any) { return this.svc.create({ ...dto, userId: u.id }); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: any, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
```

- [ ] **Step 4: RulesService — scope to userId**

```typescript
list(userId: string) { return this.repo.find({ where: { userId }, order: { priority: 'DESC', createdAt: 'ASC' } }); }

create(dto: CreateRuleDto, userId: string) {
  return this.repo.save(this.repo.create({ ...dto, priority: dto.priority ?? 0, active: dto.active ?? true, userId } as any));
}

async update(id: string, dto: UpdateRuleDto, userId: string) {
  await this.repo.update({ id, userId }, dto as any);
  return this.repo.findOne({ where: { id } });
}

async remove(id: string, userId: string) {
  const r = await this.repo.findOne({ where: { id, userId } });
  if (!r) throw new NotFoundException('Regra não encontrada');
  await this.repo.delete(id);
}

async applyAll(userId: string): Promise<{ updated: number }> {
  const rules = await this.repo.find({ where: { active: true, userId }, order: { priority: 'DESC' } });
  if (!rules.length) return { updated: 0 };
  const txs = await this.txRepo.find({ where: { categoria: 'Outros', userId } });
  let updated = 0;
  for (const tx of txs) {
    const match = rules.find((r) => this.matches(tx.descricao, r.pattern));
    if (match) { await this.txRepo.update(tx.id, { categoria: match.categoria }); updated++; }
  }
  return { updated };
}

async loadActive(userId: string): Promise<TxRule[]> {
  return this.repo.find({ where: { active: true, userId }, order: { priority: 'DESC' } });
}
```

RulesController:
```typescript
import { CurrentUser } from '../auth/auth.module';
// ...
@Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
@Post() create(@Body() dto: CreateRuleDto, @CurrentUser() u: any) { return this.svc.create(dto, u.id); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
@Post('apply') apply(@CurrentUser() u: any) { return this.svc.applyAll(u.id); }
```

- [ ] **Step 5: RemindersService — scope to userId**

```typescript
list(userId: string) { return this.repo.find({ where: { userId }, order: { dia: 'ASC' } }); }

async upcoming(userId: string) {
  const all = await this.repo.find({ where: { active: true, userId } });
  const today = new Date();
  const d = today.getDate();
  const maxDay = d + 7;
  return all.filter((r) => r.dia >= d && r.dia <= maxDay).map((r) => ({ ...r, diasRestantes: r.dia - d }));
}

create(dto: CreateReminderDto, userId: string) {
  return this.repo.save(this.repo.create({ ...dto, categoria: dto.categoria ?? 'Outros', active: dto.active ?? true, userId } as any));
}

async update(id: string, dto: UpdateReminderDto, userId: string) {
  await this.repo.update({ id, userId }, dto as any);
  return this.repo.findOne({ where: { id } });
}

async remove(id: string, userId: string) { await this.repo.delete({ id, userId }); }

async markPaid(id: string, userId: string) {
  await this.repo.update({ id, userId }, { lastPaid: new Date().toISOString() });
  return this.repo.findOne({ where: { id } });
}
```

RemindersController:
```typescript
import { CurrentUser } from '../auth/auth.module';
// ...
@Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
@Get('upcoming') upcoming(@CurrentUser() u: any) { return this.svc.upcoming(u.id); }
@Post() create(@Body() dto: CreateReminderDto, @CurrentUser() u: any) { return this.svc.create(dto, u.id); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateReminderDto, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Post(':id/paid') paid(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.markPaid(id, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
```

- [ ] **Step 6: TripsService — scope to userId**

```typescript
async list(userId: string): Promise<TripProgress[]> {
  const trips = await this.repo.find({ where: { userId }, order: { inicio: 'DESC' } });
  const today = new Date().toISOString().slice(0, 10);
  return Promise.all(trips.map(async (t) => {
    const rows = await this.txRepo.createQueryBuilder('tx')
      .where(`tx.is_transfer = 0 AND tx.valor < 0 AND tx.data >= :start AND tx.data <= :end AND tx.tags LIKE :tagpat AND tx.user_id = :uid`, {
        start: t.inicio, end: t.fim, tagpat: `%"${t.tag}"%`, uid: userId,
      }).getMany();
    // rest unchanged
  }));
}

async create(dto: CreateTripDto, userId: string) {
  if (dto.fim < dto.inicio) throw new NotFoundException('Fim antes do início');
  const tag = await this.uniqueTag(dto.nome, userId);
  return this.repo.save({ nome: dto.nome, tag, inicio: dto.inicio, fim: dto.fim, orcamento: dto.orcamento ?? null, cor: dto.cor ?? '#22d3ee', userId } as any);
}

private async uniqueTag(nome: string, userId: string): Promise<string> {
  const base = slug(nome);
  let t = base; let n = 1;
  while (await this.repo.findOne({ where: { tag: t, userId } })) { n++; t = `${base}-${n}`; }
  return t;
}

async update(id: string, dto: UpdateTripDto, userId: string) {
  await this.repo.update({ id, userId }, dto as any);
  return this.repo.findOne({ where: { id } });
}

async remove(id: string, userId: string) { await this.repo.delete({ id, userId }); }

async activeToday(userId: string): Promise<Trip | null> {
  const today = new Date().toISOString().slice(0, 10);
  return this.repo.createQueryBuilder('t')
    .where('t.inicio <= :d AND t.fim >= :d AND t.user_id = :uid', { d: today, uid: userId })
    .orderBy('t.created_at', 'DESC').getOne();
}
```

TripsController:
```typescript
import { CurrentUser } from '../auth/auth.module';
// ...
@Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
@Get('active-today') active(@CurrentUser() u: any) { return this.svc.activeToday(u.id); }
@Post() create(@Body() dto: CreateTripDto, @CurrentUser() u: any) { return this.svc.create(dto, u.id); }
@Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTripDto, @CurrentUser() u: any) { return this.svc.update(id, dto, u.id); }
@Delete(':id') async remove(@Param('id') id: string, @CurrentUser() u: any) { await this.svc.remove(id, u.id); return { ok: true }; }
```

---

## Task 7: Update AiService and AiController

**Files:**
- Modify: `backend/src/ai/ai.service.ts`
- Modify: `backend/src/ai/ai.controller.ts`

- [ ] **Step 1: Update AiService memory methods**

```typescript
async getMemory(userId: string): Promise<string> {
  const row = await this.memoryRepo.findOne({ where: { userId } });
  return row?.content ?? '';
}

async setMemory(userId: string, content: string): Promise<string> {
  const clean = (content ?? '').trim().slice(0, 4000);
  await this.memoryRepo.upsert({ userId, content: clean }, ['userId']);
  return clean;
}
```

Update `buildSys` to accept userId:
```typescript
private async buildSys(userId: string, taskRules: string, extraContext?: string): Promise<string> {
  const userMemory = await this.getMemory(userId);
  return buildSystemPrompt({ userMemory, taskRules, extraContext });
}
```

For every method in `ai.service.ts` that calls `this.buildSys(...)`, add `userId: string` as a parameter and pass it through. These methods include: `categorizeBatch`, `analyze`, `chat`, `forecast`, `translateSearchQuery`, `parseNaturalTransaction`, `ocrReceipt`, `ocrMultiReceipt`, `extractTransactions`.

- [ ] **Step 2: Update AiController**

```typescript
import { CurrentUser } from '../auth/auth.module';

@Controller('ai')
export class AiController {
  // ...

  @Get('memory')
  async getMemory(@CurrentUser() u: any) {
    const content = await this.ai.getMemory(u.id);
    return { content };
  }

  @Post('memory')
  async setMemory(@Body() body: { content: string }, @CurrentUser() u: any) {
    const content = await this.ai.setMemory(u.id, body?.content ?? '');
    return { content };
  }

  @Post('search')
  async search(@Body() body: { text: string }, @CurrentUser() u: any) {
    const today = new Date().toISOString().slice(0, 10);
    const filters = await this.ai.translateSearchQuery(body.text, today);
    const items = await this.txs.findFiltered({ mes: filters.mes, ano: filters.ano, categoria: filters.categoria, q: filters.q, tipo: filters.tipo }, u.id);
    let final = items;
    if (filters.from) final = final.filter((t) => t.data >= filters.from!);
    if (filters.to) final = final.filter((t) => t.data <= filters.to!);
    return { filters, items: final.slice(0, 100), total: final.reduce((s, t) => s + t.valor, 0), count: final.length };
  }

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeDto, @CurrentUser() u: any) {
    const rows = await this.txs.findByMonth(dto.mes, dto.ano, u.id);
    const priorMes = dto.mes === 1 ? 12 : dto.mes - 1;
    const priorAno = dto.mes === 1 ? dto.ano - 1 : dto.ano;
    const priorRows = await this.txs.findByMonth(priorMes, priorAno, u.id);
    const priorMonth = priorRows.length ? { mes: priorMes, ano: priorAno, totalGasto: priorRows.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0), totalEntrada: priorRows.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0) } : undefined;
    const texto = await this.ai.analyze(rows, dto.mes, dto.ano, priorMonth);
    return { texto };
  }

  @Post('forecast')
  async forecast(@Body() dto: AnalyzeDto, @CurrentUser() u: any) {
    const series: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = dto.mes - i <= 0 ? dto.mes - i + 12 : dto.mes - i;
      const y = dto.mes - i <= 0 ? dto.ano - 1 : dto.ano;
      const rows = await this.txs.findByMonth(m, y, u.id);
      series[`${y}-${String(m).padStart(2, '0')}`] = rows.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
    }
    return this.ai.forecast(series);
  }

  @Post('chat')
  async chat(@Body() dto: ChatDto, @CurrentUser() u: any) {
    const now = new Date();
    const mes = dto.mes ?? now.getMonth() + 1;
    const ano = dto.ano ?? now.getFullYear();
    const rows = await this.txs.findByMonth(mes, ano, u.id);
    const expenses = rows.filter((r) => r.valor < 0);
    const income = rows.filter((r) => r.valor > 0);
    const totalGasto = expenses.reduce((s, r) => s + r.valor, 0);
    const totalEntrada = income.reduce((s, r) => s + r.valor, 0);
    const porCategoria: Record<string, number> = {};
    for (const r of expenses) porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + r.valor;
    const top = [...expenses].sort((a, b) => a.valor - b.valor).slice(0, 5);
    const contexto = [
      `Mês analisado: ${String(mes).padStart(2, '0')}/${ano}`,
      `Total de gastos: R$ ${Math.abs(totalGasto).toFixed(2)} em ${expenses.length} transações.`,
      `Total de entradas: R$ ${totalEntrada.toFixed(2)} em ${income.length} transações.`,
      `Saldo: R$ ${(totalEntrada + totalGasto).toFixed(2)}.`, '',
      'Gastos por categoria:',
      Object.entries(porCategoria).sort((a, b) => a[1] - b[1]).map(([k, v]) => `- ${k}: R$ ${Math.abs(v).toFixed(2)}`).join('\n'), '',
      'Top 5 maiores gastos deste mês:',
      top.map((t) => `- ${t.data} · R$ ${Math.abs(t.valor).toFixed(2)} · [${t.categoria}] ${t.descricao.slice(0, 80)}`).join('\n'),
    ].join('\n');
    const resposta = await this.ai.chat(dto.mensagem, dto.historico, contexto);
    await this.msgRepo.save([
      this.msgRepo.create({ role: 'user', content: dto.mensagem, userId: u.id }),
      this.msgRepo.create({ role: 'assistant', content: resposta, userId: u.id }),
    ]);
    return { resposta };
  }

  @Get('chat/history')
  async history(@CurrentUser() u: any) {
    const msgs = await this.msgRepo.find({ where: { userId: u.id }, order: { createdAt: 'ASC' }, take: 200 });
    return msgs.map((m) => ({ role: m.role, content: m.content }));
  }

  @Delete('chat/history')
  async clearHistory(@CurrentUser() u: any) {
    await this.msgRepo.delete({ userId: u.id });
    return { ok: true };
  }
}
```

---

## Task 8: Restart Backend and Verify

- [ ] **Step 1: Start backend**

```bash
cd backend && npm run start:dev
```

Expected: migration runs automatically, no errors, server starts on port 3001.

- [ ] **Step 2: Create two test users and verify isolation**

```bash
# Create user A
curl -s -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"userA","password":"password123"}' | jq .token

# Create user B
curl -s -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"userB","password":"password123"}' | jq .token
```

- [ ] **Step 3: Create a transaction as userA and verify userB cannot see it**

```bash
# POST transaction with userA token (replace TOKEN_A)
curl -s -X POST http://localhost:3001/transactions \
  -H "Authorization: Bearer TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"data":"2026-04-19","descricao":"Test A","valor":-50,"categoria":"Outros"}'

# GET transactions with userB token (replace TOKEN_B) — should return empty array
curl -s http://localhost:3001/transactions \
  -H "Authorization: Bearer TOKEN_B"
```

Expected: userB gets `[]`.

- [ ] **Step 4: Verify months endpoint is scoped**

```bash
curl -s "http://localhost:3001/dashboard/months" -H "Authorization: Bearer TOKEN_B"
```

Expected: `[]` for userB (no months for userB yet).

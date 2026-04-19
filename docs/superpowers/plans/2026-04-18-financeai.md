# FinanceAi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user local personal finance app that ingests bank statements (CSV/PDF), categorizes spending via OpenRouter AI with model fallback, displays a responsive animated dashboard, and offers AI-powered insights and chat.

**Architecture:** Monorepo with `/backend` (NestJS + TypeORM + SQLite) and `/frontend` (React + Vite + Tailwind + Framer Motion). Backend exposes REST at :3001; frontend at :5173. AI calls go through `OpenRouterClient` with automatic fallback across free models. No auth, no multi-user.

**Tech Stack:** NestJS 10, TypeORM 0.3, better-sqlite3, Jest, multer, pdf-parse, papaparse, React 18, Vite 5, TailwindCSS 3, React Router 6, Recharts, Framer Motion, react-dropzone.

**Reference spec:** `docs/superpowers/specs/2026-04-18-financeai-design.md`

**Project conventions (apply to every task):**
- **No git.** Skip every "Commit" step in every task. Do not run `git init`, `git add`, or `git commit`.
- **Database:** SQLite via `better-sqlite3`. Database file at `backend/data/financeai.db`. Env var is `DATABASE_PATH`, not `DATABASE_URL`.
- **No live OpenRouter calls during development.** Use a placeholder `OPENROUTER_API_KEY` in `.env`; real usage will be validated manually by the user later. Smoke tests that hit the OpenRouter API are optional.

---

## Phase 1 — Backend foundation

### Task 1: Initialize NestJS backend project

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/nest-cli.json`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/.gitignore`, `backend/.env.example`

- [ ] **Step 1: Scaffold NestJS project**

Run from repo root:
```bash
npx -y @nestjs/cli@10 new backend --package-manager npm --skip-git --strict
```

When prompted for package manager, select `npm`.

- [ ] **Step 2: Install runtime dependencies**

```bash
cd backend
npm install @nestjs/typeorm typeorm better-sqlite3 @nestjs/config class-validator class-transformer multer pdf-parse papaparse
npm install -D @types/multer @types/papaparse @types/pdf-parse @types/better-sqlite3
```

- [ ] **Step 3: Replace `src/main.ts` with CORS-enabled bootstrap**

```typescript
// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.APP_REFERER ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(Number(process.env.PORT ?? 3001));
}
bootstrap();
```

- [ ] **Step 4: Create `.env.example`**

```
OPENROUTER_API_KEY=sk-or-replace-me
DATABASE_PATH=./data/financeai.db
PORT=3001
APP_REFERER=http://localhost:5173
APP_TITLE=FinanceAi
```

Add `.env` to `backend/.gitignore` (Nest scaffold already includes most, append `.env` if missing).

- [ ] **Step 5: Verify project builds**

```bash
cd backend && npm run build
```
Expected: build succeeds, `dist/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git init  # if not already a repo
git add backend/.gitignore backend/package.json backend/package-lock.json backend/tsconfig*.json backend/nest-cli.json backend/src backend/.env.example
git commit -m "feat(backend): scaffold NestJS project with config and CORS"
```

---

### Task 2: Configure TypeORM and database module

**Files:**
- Create: `backend/src/database/database.module.ts`, `backend/src/database/data-source.ts`, `backend/ormconfig.ts`

- [ ] **Step 1: Create TypeORM data source for migrations**

```typescript
// backend/src/database/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/financeai.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
});
```

- [ ] **Step 2: Create `DatabaseModule`**

```typescript
// backend/src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/financeai.db');
        mkdirSync(dirname(dbPath), { recursive: true });
        return {
          type: 'better-sqlite3' as const,
          database: dbPath,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
```

- [ ] **Step 3: Wire into `AppModule`**

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';

@Module({ imports: [DatabaseModule] })
export class AppModule {}
```

- [ ] **Step 4: Add migration scripts to `package.json`**

In `backend/package.json` `"scripts"` add:
```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:generate": "npm run typeorm -- migration:generate -d src/database/data-source.ts",
"migration:create": "npm run typeorm -- migration:create",
"migration:run": "npm run typeorm -- migration:run -d src/database/data-source.ts",
"migration:revert": "npm run typeorm -- migration:revert -d src/database/data-source.ts"
```

Install `dotenv`:
```bash
npm install dotenv
```

- [ ] **Step 5: Verify app boots (without DB) — type check only**

```bash
cd backend && npm run build
```
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add backend/src/database backend/package.json backend/package-lock.json
git commit -m "feat(backend): wire TypeORM datasource and migration scripts"
```

---

### Task 3: Create initial migration for `transactions` and `months`

**Files:**
- Create: `backend/src/database/migrations/<timestamp>-init.ts`

- [ ] **Step 1: Create migration file manually**

```bash
cd backend && npm run migration:create -- src/database/migrations/Init
```

This generates a file like `src/database/migrations/<TS>-Init.ts`. Replace its body with:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init<TS_VALUE> implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE transactions (
        id          TEXT PRIMARY KEY,
        data        TEXT NOT NULL,
        descricao   TEXT NOT NULL,
        valor       NUMERIC NOT NULL,
        categoria   TEXT NOT NULL DEFAULT 'Outros',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await q.query(`CREATE INDEX idx_transactions_data ON transactions(data)`);
    await q.query(`
      CREATE TABLE months (
        id             TEXT PRIMARY KEY,
        mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
        ano            INTEGER NOT NULL,
        total_gasto    NUMERIC NOT NULL DEFAULT 0,
        total_entrada  NUMERIC NOT NULL DEFAULT 0,
        UNIQUE (mes, ano)
      )
    `);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE months`);
    await q.query(`DROP TABLE transactions`);
  }
}
```

Replace the class name `Init<TS_VALUE>` with whatever timestamp the CLI created (e.g., `Init1713456789012`). TypeORM will generate UUIDs on the JS side for columns annotated with `@PrimaryGeneratedColumn('uuid')`.

- [ ] **Step 2: Prepare env and data directory**

```bash
cd backend
cp .env.example .env
mkdir -p data
```

SQLite will create the file at `backend/data/financeai.db` on first connection. No separate `CREATE DATABASE` step.

- [ ] **Step 3: Run migration**

```bash
cd backend && npm run migration:run
```
Expected: `Migration Init<TS> has been executed successfully.`

- [ ] **Step 4: Verify tables exist**

```bash
cd backend && node -e "const db=require('better-sqlite3')('./data/financeai.db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all());"
```
Expected: prints array including `transactions`, `months`, and `migrations`.

---

## Phase 2 — Transactions module

### Task 4: Transaction entity and module scaffold

**Files:**
- Create: `backend/src/transactions/transactions.module.ts`, `backend/src/transactions/entities/transaction.entity.ts`, `backend/src/transactions/entities/month.entity.ts`, `backend/src/transactions/categoria.enum.ts`

- [ ] **Step 1: Create category enum**

```typescript
// backend/src/transactions/categoria.enum.ts
export const CATEGORIAS = [
  'Alimentação', 'Transporte', 'Saúde', 'Lazer',
  'Educação', 'Moradia', 'Compras', 'Outros',
] as const;
export type Categoria = typeof CATEGORIAS[number];
```

- [ ] **Step 2: Create `Transaction` entity**

```typescript
// backend/src/transactions/entities/transaction.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'date' }) data: string;
  @Column({ type: 'text' }) descricao: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  valor: number;
  @Column({ type: 'varchar', length: 32, default: 'Outros' }) categoria: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

- [ ] **Step 3: Create `Month` entity**

```typescript
// backend/src/transactions/entities/month.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('months')
@Unique(['mes', 'ano'])
export class Month {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('int') mes: number;
  @Column('int') ano: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'total_gasto', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  totalGasto: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, name: 'total_entrada', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  totalEntrada: number;
}
```

- [ ] **Step 4: Create empty module**

```typescript
// backend/src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month])],
  exports: [TypeOrmModule],
})
export class TransactionsModule {}
```

Register in `AppModule`:
```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({ imports: [DatabaseModule, TransactionsModule] })
export class AppModule {}
```

- [ ] **Step 5: Build to verify**

```bash
cd backend && npm run build
```
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add backend/src/transactions backend/src/app.module.ts
git commit -m "feat(transactions): add Transaction and Month entities"
```

---

### Task 5: CSV parser with tests (TDD)

**Files:**
- Create: `backend/src/transactions/parsers/csv.parser.ts`, `backend/src/transactions/parsers/csv.parser.spec.ts`, `backend/src/transactions/parsers/types.ts`, `backend/test/fixtures/extrato.csv`, `backend/test/fixtures/extrato-br.csv`

- [ ] **Step 1: Define shared parser types**

```typescript
// backend/src/transactions/parsers/types.ts
export type RawTransaction = { data: string; descricao: string; valor: number };
```

- [ ] **Step 2: Create CSV fixtures**

`backend/test/fixtures/extrato.csv`:
```
data,descricao,valor
2026-04-01,Supermercado XYZ,-150.45
2026-04-02,Salário,3500.00
2026-04-03,Uber,-22.30
```

`backend/test/fixtures/extrato-br.csv`:
```
data;descricao;valor
01/04/2026;Padaria;-12,50
02/04/2026;Aluguel;-1.200,00
```

- [ ] **Step 3: Write failing test**

```typescript
// backend/src/transactions/parsers/csv.parser.spec.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { CsvParser } from './csv.parser';

describe('CsvParser', () => {
  const parser = new CsvParser();
  const load = (name: string) => readFileSync(join(__dirname, '../../../test/fixtures', name));

  it('parses ISO date + dot-decimal CSV', () => {
    const result = parser.parse(load('extrato.csv'));
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Supermercado XYZ', valor: -150.45 });
    expect(result[1].valor).toBe(3500);
  });

  it('parses BR date + comma-decimal CSV with semicolon separator', () => {
    const result = parser.parse(load('extrato-br.csv'));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Padaria', valor: -12.5 });
    expect(result[1]).toEqual({ data: '2026-04-02', descricao: 'Aluguel', valor: -1200 });
  });

  it('throws on missing required column', () => {
    const bad = Buffer.from('data,descricao\n2026-04-01,foo');
    expect(() => parser.parse(bad)).toThrow(/coluna.*valor/i);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd backend && npm test -- csv.parser
```
Expected: FAIL — `Cannot find module './csv.parser'`.

- [ ] **Step 5: Implement `CsvParser`**

```typescript
// backend/src/transactions/parsers/csv.parser.ts
import { parse as parseCsv } from 'papaparse';
import { RawTransaction } from './types';

export class CsvParser {
  parse(buffer: Buffer): RawTransaction[] {
    const text = buffer.toString('utf8');
    const sep = text.includes(';') && !text.includes(',') ? ';' : (text.split('\n')[0].includes(';') ? ';' : ',');
    const { data, errors } = parseCsv<Record<string, string>>(text, {
      header: true, skipEmptyLines: true, delimiter: sep,
    });
    if (errors.length) throw new Error(`CSV parse error: ${errors[0].message}`);
    if (!data.length) throw new Error('CSV vazio');
    const required = ['data', 'descricao', 'valor'];
    for (const col of required) {
      if (!(col in data[0])) throw new Error(`Coluna obrigatória ausente: ${col}`);
    }
    return data.map((row) => ({
      data: this.normalizeDate(row.data),
      descricao: row.descricao.trim(),
      valor: this.normalizeValor(row.valor),
    }));
  }

  private normalizeDate(s: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    throw new Error(`Data inválida: ${s}`);
  }

  private normalizeValor(s: string): number {
    const cleaned = s.trim().replace(/\s/g, '');
    const isBr = /,\d{1,2}$/.test(cleaned);
    const normalized = isBr ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const n = Number(normalized);
    if (Number.isNaN(n)) throw new Error(`Valor inválido: ${s}`);
    return n;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && npm test -- csv.parser
```
Expected: 3 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/transactions/parsers backend/test/fixtures
git commit -m "feat(parsers): CsvParser with BR/ISO date and comma/dot decimal support"
```

---

### Task 6: PDF parser with heuristic + AI fallback hook (TDD)

**Files:**
- Create: `backend/src/transactions/parsers/pdf.parser.ts`, `backend/src/transactions/parsers/pdf.parser.spec.ts`, `backend/test/fixtures/extrato-limpo.txt`

> Note: We use a `.txt` fixture and inject a `textExtractor` to keep tests fast and avoid bundling sample PDFs. Real PDF reading uses `pdf-parse` in production.

- [ ] **Step 1: Create text fixture mimicking pdf-parse output**

`backend/test/fixtures/extrato-limpo.txt`:
```
Banco XPTO - Extrato
Periodo 01/04/2026 a 30/04/2026
01/04/2026 Supermercado ABC -150,45
02/04/2026 Salario 3.500,00
03/04/2026 Uber -22,30
05/04/2026 Farmacia -47,80
Saldo final: 3.279,45
```

- [ ] **Step 2: Write failing test**

```typescript
// backend/src/transactions/parsers/pdf.parser.spec.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { PdfParser } from './pdf.parser';

describe('PdfParser', () => {
  const txt = (name: string) => readFileSync(join(__dirname, '../../../test/fixtures', name), 'utf8');

  it('parses heuristically when text matches dd/mm/yyyy pattern', async () => {
    const parser = new PdfParser({ extractText: async () => txt('extrato-limpo.txt'), fallbackAi: jest.fn() });
    const result = await parser.parse(Buffer.from('fake'));
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Supermercado ABC', valor: -150.45 });
    expect(result[1].valor).toBe(3500);
  });

  it('falls back to AI when heuristic finds <3 lines', async () => {
    const aiResult = [{ data: '2026-04-01', descricao: 'X', valor: -10 }];
    const fallback = jest.fn().mockResolvedValue(aiResult);
    const parser = new PdfParser({ extractText: async () => 'lixo sem datas', fallbackAi: fallback });
    const result = await parser.parse(Buffer.from('fake'));
    expect(fallback).toHaveBeenCalledWith('lixo sem datas');
    expect(result).toEqual(aiResult);
  });

  it('throws when extracted text is empty (scanned PDF)', async () => {
    const parser = new PdfParser({ extractText: async () => '   ', fallbackAi: jest.fn() });
    await expect(parser.parse(Buffer.from('fake'))).rejects.toThrow(/imagem/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npm test -- pdf.parser
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `PdfParser`**

```typescript
// backend/src/transactions/parsers/pdf.parser.ts
import pdfParse from 'pdf-parse';
import { RawTransaction } from './types';

export type PdfParserDeps = {
  extractText?: (buf: Buffer) => Promise<string>;
  fallbackAi: (rawText: string) => Promise<RawTransaction[]>;
};

const HEURISTIC_RE = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d\.]+,\d{2})/g;
const MIN_LINES = 3;

export class PdfParser {
  constructor(private readonly deps: PdfParserDeps) {}

  async parse(buffer: Buffer): Promise<RawTransaction[]> {
    const extract = this.deps.extractText ?? (async (b) => (await pdfParse(b)).text);
    const text = await extract(buffer);
    if (!text || !text.trim()) throw new Error('PDF parece ser imagem; use CSV ou PDF com texto nativo.');

    const matches = [...text.matchAll(HEURISTIC_RE)];
    if (matches.length >= MIN_LINES) {
      return matches.map((m) => ({
        data: this.toIso(m[1]),
        descricao: m[2].trim(),
        valor: this.toNumber(m[3]),
      }));
    }
    return this.deps.fallbackAi(text);
  }

  private toIso(s: string): string {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  private toNumber(s: string): number {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- pdf.parser
```
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/transactions/parsers/pdf.parser.ts backend/src/transactions/parsers/pdf.parser.spec.ts backend/test/fixtures/extrato-limpo.txt
git commit -m "feat(parsers): PdfParser with heuristic + AI fallback hook"
```

---

### Task 7: TransactionsService — CRUD + months recompute (TDD)

**Files:**
- Create: `backend/src/transactions/transactions.service.ts`, `backend/src/transactions/transactions.service.spec.ts`

- [ ] **Step 1: Write failing test (recomputeMonth)**

```typescript
// backend/src/transactions/transactions.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: jest.Mocked<Repository<Transaction>>;
  let monthRepo: jest.Mocked<Repository<Month>>;

  beforeEach(async () => {
    txRepo = { createQueryBuilder: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), delete: jest.fn(), update: jest.fn() } as any;
    monthRepo = { upsert: jest.fn() } as any;
    const mod = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(Month), useValue: monthRepo },
      ],
    }).compile();
    service = mod.get(TransactionsService);
  });

  it('recomputeMonth aggregates and upserts month totals', async () => {
    txRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ gasto: '-300.50', entrada: '1000.00' }),
    } as any);

    await service.recomputeMonth(4, 2026);

    expect(monthRepo.upsert).toHaveBeenCalledWith(
      { mes: 4, ano: 2026, totalGasto: -300.5, totalEntrada: 1000 },
      ['mes', 'ano'],
    );
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd backend && npm test -- transactions.service
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement service**

```typescript
// backend/src/transactions/transactions.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { RawTransaction } from './parsers/types';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Month) private readonly monthRepo: Repository<Month>,
  ) {}

  async createMany(rows: (RawTransaction & { categoria?: string })[]) {
    const saved = await this.txRepo.save(rows.map((r) => ({ ...r, categoria: r.categoria ?? 'Outros' })));
    const monthsTouched = new Set<string>();
    for (const t of saved) {
      const [y, m] = t.data.split('-');
      monthsTouched.add(`${m}-${y}`);
    }
    for (const key of monthsTouched) {
      const [m, y] = key.split('-');
      await this.recomputeMonth(Number(m), Number(y));
    }
    return saved;
  }

  async findByMonth(mes: number, ano: number) {
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endMonth = mes === 12 ? 1 : mes + 1;
    const endYear = mes === 12 ? ano + 1 : ano;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    return this.txRepo
      .createQueryBuilder('t')
      .where('t.data >= :start AND t.data < :end', { start, end })
      .orderBy('t.data', 'DESC')
      .getMany();
  }

  async updateCategoria(id: string, categoria: string) {
    await this.txRepo.update(id, { categoria });
    const tx = await this.txRepo.findOne({ where: { id } });
    if (tx) {
      const [y, m] = tx.data.split('-');
      await this.recomputeMonth(Number(m), Number(y));
    }
    return tx;
  }

  async remove(id: string) {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) return;
    await this.txRepo.delete(id);
    const [y, m] = tx.data.split('-');
    await this.recomputeMonth(Number(m), Number(y));
  }

  async recomputeMonth(mes: number, ano: number) {
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endMonth = mes === 12 ? 1 : mes + 1;
    const endYear = mes === 12 ? ano + 1 : ano;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    const row = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(CASE WHEN t.valor < 0 THEN t.valor ELSE 0 END), 0)', 'gasto')
      .addSelect('COALESCE(SUM(CASE WHEN t.valor > 0 THEN t.valor ELSE 0 END), 0)', 'entrada')
      .where('t.data >= :start AND t.data < :end', { start, end })
      .getRawOne<{ gasto: string; entrada: string }>();
    await this.monthRepo.upsert(
      { mes, ano, totalGasto: Number(row?.gasto ?? 0), totalEntrada: Number(row?.entrada ?? 0) },
      ['mes', 'ano'],
    );
  }
}
```

Register in `TransactionsModule` `providers`:
```typescript
providers: [TransactionsService],
exports: [TypeOrmModule, TransactionsService],
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- transactions.service
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/transactions/transactions.service.ts backend/src/transactions/transactions.service.spec.ts backend/src/transactions/transactions.module.ts
git commit -m "feat(transactions): TransactionsService with monthly aggregation"
```

---

### Task 8: TransactionsController + upload endpoint

**Files:**
- Create: `backend/src/transactions/transactions.controller.ts`, `backend/src/transactions/dto/update-categoria.dto.ts`

> Note: AI categorization integration happens in Task 11 — for now, upload saves with `categoria='Outros'`.

- [ ] **Step 1: Create DTO**

```typescript
// backend/src/transactions/dto/update-categoria.dto.ts
import { IsIn } from 'class-validator';
import { CATEGORIAS } from '../categoria.enum';

export class UpdateCategoriaDto {
  @IsIn(CATEGORIAS as readonly string[])
  categoria: string;
}
```

- [ ] **Step 2: Create controller**

```typescript
// backend/src/transactions/transactions.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsService } from './transactions.service';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly txs: TransactionsService,
    private readonly csv: CsvParser,
    private readonly pdf: PdfParser,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    const isCsv = file.mimetype.includes('csv') || file.originalname.endsWith('.csv');
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    let raw;
    if (isCsv) raw = this.csv.parse(file.buffer);
    else if (isPdf) raw = await this.pdf.parse(file.buffer);
    else throw new BadRequestException('Apenas .csv ou .pdf');
    const saved = await this.txs.createMany(raw);
    return { count: saved.length, transactions: saved };
  }

  @Get()
  list(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.txs.findByMonth(Number(mes), Number(ano));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.txs.updateCategoria(id, dto.categoria);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.txs.remove(id);
    return { ok: true };
  }
}
```

- [ ] **Step 3: Register in module**

```typescript
// backend/src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month])],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    CsvParser,
    { provide: PdfParser, useFactory: () => new PdfParser({ fallbackAi: async () => { throw new Error('AI fallback ainda não conectado'); } }) },
  ],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule {}
```

- [ ] **Step 4: Manual smoke test**

```bash
cd backend && npm run start:dev
```

In another terminal:
```bash
curl -F "file=@test/fixtures/extrato.csv" http://localhost:3001/transactions/upload
curl "http://localhost:3001/transactions?mes=4&ano=2026"
```
Expected: first returns `{count:3, transactions:[...]}`; second returns the 3 rows.

- [ ] **Step 5: Commit**

```bash
git add backend/src/transactions
git commit -m "feat(transactions): upload, list, update, delete endpoints"
```

---

## Phase 3 — AI module

### Task 9: OpenRouterClient with model fallback (TDD)

**Files:**
- Create: `backend/src/ai/openrouter.client.ts`, `backend/src/ai/openrouter.client.spec.ts`, `backend/src/ai/errors.ts`, `backend/src/ai/rate-limiter.ts`

- [ ] **Step 1: Define errors**

```typescript
// backend/src/ai/errors.ts
export class AiAuthError extends Error { constructor() { super('OpenRouter API key inválida'); } }
export class AiUnavailableError extends Error { constructor() { super('Todos os modelos AI esgotados'); } }
```

- [ ] **Step 2: Simple token bucket**

```typescript
// backend/src/ai/rate-limiter.ts
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private readonly capacity: number, private readonly refillPerSec: number) {
    this.tokens = capacity;
  }
  async acquire() {
    while (true) {
      this.refill();
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerSec * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  private refill() {
    const now = Date.now();
    const delta = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillPerSec);
    this.last = now;
  }
}
```

- [ ] **Step 3: Write failing tests**

```typescript
// backend/src/ai/openrouter.client.spec.ts
import { OpenRouterClient } from './openrouter.client';
import { AiAuthError, AiUnavailableError } from './errors';

const okResponse = (content: string) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }], model: 'm' }),
});
const errResponse = (status: number) => ({ ok: false, status, json: async () => ({ error: 'x' }), text: async () => 'x' });

describe('OpenRouterClient', () => {
  const baseConfig = {
    apiKey: 'sk-test', referer: 'http://localhost', title: 'Test',
    models: ['model-a', 'model-b', 'model-c'], rateLimit: { capacity: 100, refillPerSec: 100 },
  };

  it('returns content from first successful model', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse('hello'));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    const res = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to next model on 429', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(errResponse(429))
      .mockResolvedValueOnce(okResponse('from b'));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    const res = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('from b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AiAuthError on 401 without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(errResponse(401));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(AiAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws AiUnavailableError when all models fail with 429', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errResponse(429));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 4: Run, verify FAIL**

```bash
cd backend && npm test -- openrouter
```
Expected: module not found.

- [ ] **Step 5: Implement client**

```typescript
// backend/src/ai/openrouter.client.ts
import { AiAuthError, AiUnavailableError } from './errors';
import { TokenBucket } from './rate-limiter';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type OpenRouterConfig = {
  apiKey: string; referer: string; title: string;
  models: string[];
  rateLimit?: { capacity: number; refillPerSec: number };
  timeoutMs?: number;
};
export type ChatResult = { content: string; model: string };

export class OpenRouterClient {
  private bucket: TokenBucket;
  constructor(
    private readonly cfg: OpenRouterConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    const rl = cfg.rateLimit ?? { capacity: 20, refillPerSec: 20 / 60 };
    this.bucket = new TokenBucket(rl.capacity, rl.refillPerSec);
  }

  async chat(messages: ChatMessage[], opts: { jsonMode?: boolean } = {}): Promise<ChatResult> {
    let lastErr: Error | null = null;
    for (const model of this.cfg.models) {
      await this.bucket.acquire();
      try {
        return await this.callOnce(model, messages, opts.jsonMode ?? false);
      } catch (e) {
        if (e instanceof AiAuthError) throw e;
        lastErr = e as Error;
      }
    }
    throw lastErr instanceof AiUnavailableError ? lastErr : new AiUnavailableError();
  }

  private async callOnce(model: string, messages: ChatMessage[], jsonMode: boolean): Promise<ChatResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 30000);
    try {
      const res = await this.fetchFn('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cfg.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.cfg.referer,
          'X-Title': this.cfg.title,
        },
        body: JSON.stringify({
          model, messages,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: ctrl.signal,
      });
      if (res.status === 401) throw new AiAuthError();
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Modelo ${model} indisponível (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Resposta sem content');
      return { content, model: json.model ?? model };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 6: Run tests**

```bash
cd backend && npm test -- openrouter
```
Expected: 4 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ai
git commit -m "feat(ai): OpenRouterClient with model fallback and rate limiting"
```

---

### Task 10: AiService — categorize, extract, analyze, forecast, chat

**Files:**
- Create: `backend/src/ai/ai.service.ts`, `backend/src/ai/ai.module.ts`, `backend/src/ai/ai.service.spec.ts`

- [ ] **Step 1: Write failing test for `categorizeBatch`**

```typescript
// backend/src/ai/ai.service.spec.ts
import { AiService } from './ai.service';
import { OpenRouterClient } from './openrouter.client';

describe('AiService.categorizeBatch', () => {
  it('parses JSON response into categoria per index', async () => {
    const chat = jest.fn().mockResolvedValue({
      content: '[{"index":0,"categoria":"Alimentação"},{"index":1,"categoria":"Transporte"}]',
      model: 'm',
    });
    const client = { chat } as unknown as OpenRouterClient;
    const svc = new AiService(client);
    const result = await svc.categorizeBatch([
      { data: '2026-04-01', descricao: 'Padaria', valor: -10 },
      { data: '2026-04-02', descricao: 'Uber', valor: -22 },
    ]);
    expect(result).toEqual([{ index: 0, categoria: 'Alimentação' }, { index: 1, categoria: 'Transporte' }]);
  });

  it('retries once on malformed JSON, then returns Outros for all', async () => {
    const chat = jest.fn()
      .mockResolvedValueOnce({ content: 'lixo', model: 'm' })
      .mockResolvedValueOnce({ content: 'ainda lixo', model: 'm' });
    const svc = new AiService({ chat } as any);
    const result = await svc.categorizeBatch([
      { data: '2026-04-01', descricao: 'X', valor: -1 },
    ]);
    expect(result).toEqual([{ index: 0, categoria: 'Outros' }]);
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd backend && npm test -- ai.service
```
Expected: module not found.

- [ ] **Step 3: Implement `AiService`**

```typescript
// backend/src/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import { OpenRouterClient, ChatMessage } from './openrouter.client';
import { RawTransaction } from '../transactions/parsers/types';
import { CATEGORIAS } from '../transactions/categoria.enum';

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class AiService {
  constructor(private readonly client: OpenRouterClient) {}

  async categorizeBatch(rows: RawTransaction[]): Promise<{ index: number; categoria: string }[]> {
    const list = rows.map((r, i) => `${i}: ${r.descricao} (${r.valor})`).join('\n');
    const sys = `Você categoriza transações financeiras. Categorias permitidas: ${CATEGORIAS.join(', ')}. Responda APENAS um JSON array no formato [{"index":N,"categoria":"X"}]. Sem texto extra.`;
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: list },
    ];
    return this.tryParseJson(messages, rows.length);
  }

  async extractTransactions(rawText: string): Promise<RawTransaction[]> {
    const sys = `Você extrai transações de extrato bancário. Responda APENAS um JSON array [{"data":"YYYY-MM-DD","descricao":"...","valor":N}]. Negativo = gasto. Sem texto extra.`;
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: rawText.slice(0, 8000) },
    ];
    const res = await this.client.chat(messages, { jsonMode: true });
    try {
      const parsed = JSON.parse(this.stripFences(res.content));
      if (!Array.isArray(parsed)) throw new Error('not array');
      return parsed.filter((p) => p.data && p.descricao && typeof p.valor === 'number');
    } catch {
      return [];
    }
  }

  async analyze(transactions: { categoria: string; valor: number; descricao: string }[], mes: number, ano: number): Promise<string> {
    const summary = this.summarize(transactions);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Você é um consultor financeiro pessoal. Responda em português, conciso, com até 5 dicas práticas.' },
      { role: 'user', content: `Mês ${mes}/${ano}. Resumo de gastos por categoria:\n${summary}\n\nDê dicas de economia.` },
    ];
    const res = await this.client.chat(messages);
    return res.content;
  }

  async forecast(transactionsByMonth: Record<string, number>): Promise<{ texto: string; valorEstimado: number | null }> {
    const series = Object.entries(transactionsByMonth).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join('\n');
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Você prevê gastos do próximo mês. Responda em JSON {"texto":"...","valorEstimado":N}. Negativo = gasto. Sem texto extra.' },
      { role: 'user', content: `Histórico de gasto mensal:\n${series}\n\nEstime o próximo mês.` },
    ];
    const res = await this.client.chat(messages, { jsonMode: true });
    try {
      const parsed = JSON.parse(this.stripFences(res.content));
      return { texto: String(parsed.texto ?? ''), valorEstimado: typeof parsed.valorEstimado === 'number' ? parsed.valorEstimado : null };
    } catch {
      return { texto: res.content, valorEstimado: null };
    }
  }

  async chat(mensagem: string, historico: ChatHistoryItem[], contexto: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: `Você é um assistente financeiro pessoal. Use o contexto a seguir das finanças do usuário para responder.\n\n${contexto}` },
      ...historico,
      { role: 'user', content: mensagem },
    ];
    const res = await this.client.chat(messages);
    return res.content;
  }

  private async tryParseJson(messages: ChatMessage[], expectedLen: number) {
    const allowed = new Set<string>(CATEGORIAS as readonly string[]);
    const fallback = Array.from({ length: expectedLen }, (_, i) => ({ index: i, categoria: 'Outros' }));
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.chat(messages, { jsonMode: true });
      try {
        const parsed = JSON.parse(this.stripFences(res.content));
        if (!Array.isArray(parsed)) throw new Error('not array');
        return parsed.map((p, i) => ({
          index: typeof p.index === 'number' ? p.index : i,
          categoria: allowed.has(p.categoria) ? p.categoria : 'Outros',
        }));
      } catch {
        messages = [
          ...messages,
          { role: 'system', content: 'Sua última resposta não foi JSON válido. Responda APENAS o JSON array, sem markdown, sem texto extra.' },
        ];
      }
    }
    return fallback;
  }

  private stripFences(s: string): string {
    return s.trim().replace(/^```(?:json)?\n?/i, '').replace(/```$/, '').trim();
  }

  private summarize(rows: { categoria: string; valor: number }[]): string {
    const totals: Record<string, number> = {};
    for (const r of rows) {
      if (r.valor < 0) totals[r.categoria] = (totals[r.categoria] ?? 0) + r.valor;
    }
    return Object.entries(totals).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join('\n');
  }
}
```

- [ ] **Step 4: Create `AiModule`**

```typescript
// backend/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';
import { AiService } from './ai.service';

@Module({
  providers: [
    {
      provide: OpenRouterClient,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => new OpenRouterClient({
        apiKey: cfg.get<string>('OPENROUTER_API_KEY')!,
        referer: cfg.get<string>('APP_REFERER') ?? 'http://localhost:5173',
        title: cfg.get<string>('APP_TITLE') ?? 'FinanceAi',
        models: [
          'openrouter/auto',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen-2.5-72b-instruct:free',
          'google/gemini-2.0-flash-exp:free',
        ],
      }),
    },
    AiService,
  ],
  exports: [AiService, OpenRouterClient],
})
export class AiModule {}
```

Register in `AppModule.imports`.

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- ai.service
```
Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai backend/src/app.module.ts
git commit -m "feat(ai): AiService with categorize/extract/analyze/forecast/chat"
```

---

### Task 11: Wire AI into transactions upload + PDF fallback

**Files:**
- Modify: `backend/src/transactions/transactions.module.ts`, `backend/src/transactions/transactions.controller.ts`

- [ ] **Step 1: Update `TransactionsModule` to import `AiModule` and inject AI into PdfParser/Controller**

```typescript
// backend/src/transactions/transactions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Month } from './entities/month.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';
import { AiModule } from '../ai/ai.module';
import { AiService } from '../ai/ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month]), AiModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    CsvParser,
    {
      provide: PdfParser,
      inject: [AiService],
      useFactory: (ai: AiService) => new PdfParser({ fallbackAi: (text) => ai.extractTransactions(text) }),
    },
  ],
  exports: [TypeOrmModule, TransactionsService],
})
export class TransactionsModule {}
```

- [ ] **Step 2: Use AI in upload endpoint**

```typescript
// backend/src/transactions/transactions.controller.ts (replace upload method)
constructor(
  private readonly txs: TransactionsService,
  private readonly csv: CsvParser,
  private readonly pdf: PdfParser,
  private readonly ai: AiService,
) {}

@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async upload(@UploadedFile() file: Express.Multer.File) {
  if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
  const isCsv = file.mimetype.includes('csv') || file.originalname.endsWith('.csv');
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
  let raw;
  if (isCsv) raw = this.csv.parse(file.buffer);
  else if (isPdf) raw = await this.pdf.parse(file.buffer);
  else throw new BadRequestException('Apenas .csv ou .pdf');

  const cats = await this.ai.categorizeBatch(raw);
  const enriched = raw.map((r, i) => ({ ...r, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' }));
  const saved = await this.txs.createMany(enriched);
  return { count: saved.length, transactions: saved };
}
```

Add `import { AiService } from '../ai/ai.service';` at top.

- [ ] **Step 3: Map AI errors to HTTP errors**

Create exception filter:

```typescript
// backend/src/ai/ai-errors.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AiAuthError, AiUnavailableError } from './errors';

@Catch(AiAuthError, AiUnavailableError)
export class AiErrorsFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AiAuthError) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'API key inválida, verifique OPENROUTER_API_KEY.' });
    }
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ message: 'Limite da IA atingido (200/dia grátis). Tente novamente mais tarde.' });
  }
}
```

Register globally in `main.ts`:
```typescript
import { AiErrorsFilter } from './ai/ai-errors.filter';
// ...
app.useGlobalFilters(new AiErrorsFilter());
```

- [ ] **Step 4: Manual smoke test**

Set valid `OPENROUTER_API_KEY` in `.env`, then:

```bash
cd backend && npm run start:dev
curl -F "file=@test/fixtures/extrato.csv" http://localhost:3001/transactions/upload
```
Expected: returns 3 transactions with reasonable categories (e.g., `Alimentação`, `Outros`, `Transporte`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/transactions backend/src/ai backend/src/main.ts
git commit -m "feat(ai): wire AI categorization into upload and PDF fallback"
```

---

### Task 12: AiController — analyze, forecast, chat endpoints

**Files:**
- Create: `backend/src/ai/ai.controller.ts`, `backend/src/ai/dto/*.dto.ts`

- [ ] **Step 1: DTOs**

```typescript
// backend/src/ai/dto/analyze.dto.ts
import { IsInt, Max, Min } from 'class-validator';
export class AnalyzeDto {
  @IsInt() @Min(1) @Max(12) mes: number;
  @IsInt() ano: number;
}
```

```typescript
// backend/src/ai/dto/chat.dto.ts
import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HistoryItemDto {
  @IsString() role: 'user' | 'assistant';
  @IsString() @MaxLength(4000) content: string;
}
export class ChatDto {
  @IsString() @MaxLength(2000) mensagem: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => HistoryItemDto) historico: HistoryItemDto[];
}
```

- [ ] **Step 2: Controller**

```typescript
// backend/src/ai/ai.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AnalyzeDto } from './dto/analyze.dto';
import { ChatDto } from './dto/chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly txs: TransactionsService) {}

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeDto) {
    const rows = await this.txs.findByMonth(dto.mes, dto.ano);
    const texto = await this.ai.analyze(rows, dto.mes, dto.ano);
    return { texto };
  }

  @Post('forecast')
  async forecast(@Body() dto: AnalyzeDto) {
    const series: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = dto.mes - i <= 0 ? dto.mes - i + 12 : dto.mes - i;
      const y = dto.mes - i <= 0 ? dto.ano - 1 : dto.ano;
      const rows = await this.txs.findByMonth(m, y);
      const total = rows.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
      series[`${y}-${String(m).padStart(2, '0')}`] = total;
    }
    return this.ai.forecast(series);
  }

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    const now = new Date();
    const rows = await this.txs.findByMonth(now.getMonth() + 1, now.getFullYear());
    const totals: Record<string, number> = {};
    for (const r of rows) if (r.valor < 0) totals[r.categoria] = (totals[r.categoria] ?? 0) + r.valor;
    const contexto = `Gastos do mês atual por categoria:\n${Object.entries(totals).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join('\n')}`;
    const resposta = await this.ai.chat(dto.mensagem, dto.historico, contexto);
    return { resposta };
  }
}
```

- [ ] **Step 3: Register controller in `AiModule`**

```typescript
// backend/src/ai/ai.module.ts
import { TransactionsModule } from '../transactions/transactions.module';
import { AiController } from './ai.controller';
import { forwardRef } from '@nestjs/common';
// inside @Module:
imports: [forwardRef(() => TransactionsModule)],
controllers: [AiController],
```

And update `TransactionsModule` to use `forwardRef` for AiModule:
```typescript
imports: [TypeOrmModule.forFeature([Transaction, Month]), forwardRef(() => AiModule)],
```

- [ ] **Step 4: Smoke test**

```bash
curl -X POST http://localhost:3001/ai/analyze -H "Content-Type: application/json" -d '{"mes":4,"ano":2026}'
curl -X POST http://localhost:3001/ai/chat -H "Content-Type: application/json" -d '{"mensagem":"Como economizar em transporte?","historico":[]}'
```
Expected: returns text responses.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai backend/src/transactions/transactions.module.ts
git commit -m "feat(ai): analyze, forecast, chat endpoints"
```

---

## Phase 4 — Dashboard module

### Task 13: DashboardService + Controller

**Files:**
- Create: `backend/src/dashboard/dashboard.service.ts`, `backend/src/dashboard/dashboard.controller.ts`, `backend/src/dashboard/dashboard.module.ts`, `backend/src/dashboard/dashboard.service.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
// backend/src/dashboard/dashboard.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService.summary', () => {
  it('returns totals from months and aggregates by categoria', async () => {
    const monthRepo = { findOne: jest.fn().mockResolvedValue({ totalGasto: -300, totalEntrada: 1000 }) };
    const txRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { categoria: 'Alimentação', total: '-200' },
          { categoria: 'Transporte', total: '-100' },
        ]),
      }),
    };
    const mod = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(Month), useValue: monthRepo },
      ],
    }).compile();
    const svc = mod.get(DashboardService);
    const res = await svc.summary(4, 2026);
    expect(res).toEqual({
      totalGasto: -300, totalEntrada: 1000, saldo: 700,
      porCategoria: [{ categoria: 'Alimentação', total: -200 }, { categoria: 'Transporte', total: -100 }],
    });
  });
});
```

- [ ] **Step 2: Run, FAIL**

```bash
cd backend && npm test -- dashboard.service
```

- [ ] **Step 3: Implement service + controller + module**

```typescript
// backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';

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
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endMonth = mes === 12 ? 1 : mes + 1;
    const endYear = mes === 12 ? ano + 1 : ano;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    const rows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoria', 'categoria')
      .addSelect('SUM(t.valor)', 'total')
      .where('t.data >= :start AND t.data < :end AND t.valor < 0', { start, end })
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
}
```

```typescript
// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}
  @Get('summary')
  summary(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.svc.summary(Number(mes), Number(ano));
  }
  @Get('months')
  months() { return this.svc.months(); }
}
```

```typescript
// backend/src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Month } from '../transactions/entities/month.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Month])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

Register in `AppModule.imports`.

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- dashboard.service
```
Expected: PASS.

- [ ] **Step 5: Smoke test**

```bash
curl "http://localhost:3001/dashboard/summary?mes=4&ano=2026"
curl "http://localhost:3001/dashboard/months"
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/dashboard backend/src/app.module.ts
git commit -m "feat(dashboard): summary and months endpoints"
```

---

## Phase 5 — Frontend foundation

### Task 14: Initialize Vite + React + Tailwind project

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/tsconfig.json`, `frontend/.env.example`

- [ ] **Step 1: Scaffold with Vite**

From repo root:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install Tailwind + libs**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom recharts framer-motion react-dropzone
```

- [ ] **Step 3: Configure Tailwind**

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        bg: '#0f172a', card: '#1e293b', accent: '#38bdf8',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Replace `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: #0f172a; color: #e2e8f0; font-family: 'DM Sans', system-ui, sans-serif; }
```

- [ ] **Step 5: Add DM Sans + viewport to `index.html`**

Replace `<head>` content (keep `<title>` but rename to `FinanceAi`):
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<title>FinanceAi</title>
```

- [ ] **Step 6: Create `.env.example`**

```
VITE_API_URL=http://localhost:3001
```

Commit `.env` to `.gitignore`.

- [ ] **Step 7: Verify dev server starts**

```bash
cd frontend && npm run dev
```
Expected: server on http://localhost:5173 with default Vite page.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold Vite + React + Tailwind with DM Sans"
```

---

### Task 15: API client + router + layout

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, `frontend/src/components/Layout.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/BottomNav.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`

- [ ] **Step 1: Shared types**

```typescript
// frontend/src/lib/types.ts
export type Transaction = { id: string; data: string; descricao: string; valor: number; categoria: string };
export type Summary = {
  totalGasto: number; totalEntrada: number; saldo: number;
  porCategoria: { categoria: string; total: number }[];
};
export type MonthRef = { mes: number; ano: number };
```

- [ ] **Step 2: API client**

```typescript
// frontend/src/lib/api.ts
import type { MonthRef, Summary, Transaction } from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const api = {
  uploadFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http<{ count: number; transactions: Transaction[] }>('/transactions/upload', { method: 'POST', body: fd });
  },
  listTransactions: (mes: number, ano: number) =>
    http<Transaction[]>(`/transactions?mes=${mes}&ano=${ano}`),
  updateCategoria: (id: string, categoria: string) =>
    http<Transaction>(`/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria }) }),
  deleteTransaction: (id: string) =>
    http<{ ok: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),
  summary: (mes: number, ano: number) =>
    http<Summary>(`/dashboard/summary?mes=${mes}&ano=${ano}`),
  months: () => http<MonthRef[]>('/dashboard/months'),
  analyze: (mes: number, ano: number) =>
    http<{ texto: string }>('/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mes, ano }) }),
  forecast: (mes: number, ano: number) =>
    http<{ texto: string; valorEstimado: number | null }>('/ai/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mes, ano }) }),
  chat: (mensagem: string, historico: { role: 'user' | 'assistant'; content: string }[]) =>
    http<{ resposta: string }>('/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagem, historico }) }),
};

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'Limite da IA atingido. Tente novamente mais tarde.';
    if (e.status === 500 && e.message.includes('API key')) return e.message;
    return e.message;
  }
  return 'Erro de conexão com o backend (porta 3001).';
}
```

- [ ] **Step 3: Sidebar + BottomNav**

```typescript
// frontend/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
const items = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/upload', label: 'Upload', icon: '⬆️' },
  { to: '/insights', label: 'Insights', icon: '🤖' },
  { to: '/chat', label: 'Chat', icon: '💬' },
];
export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-card border-r border-slate-700 p-4 gap-2">
      <h1 className="text-2xl font-bold text-accent mb-6">FinanceAi</h1>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 p-2 rounded transition-colors ${isActive ? 'bg-accent/20 text-accent' : 'text-slate-300 hover:bg-slate-700/50'}`
          }>
          <span>{i.icon}</span><span>{i.label}</span>
        </NavLink>
      ))}
    </aside>
  );
}
```

```typescript
// frontend/src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom';
const items = [
  { to: '/', label: 'Início', icon: '📊' },
  { to: '/upload', label: 'Upload', icon: '⬆️' },
  { to: '/insights', label: 'IA', icon: '🤖' },
  { to: '/chat', label: 'Chat', icon: '💬' },
];
export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-slate-700 flex justify-around py-2 z-10">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-accent' : 'text-slate-400'}`
          }>
          <span className="text-xl">{i.icon}</span><span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Layout**

```typescript
// frontend/src/components/Layout.tsx
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function Layout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:pb-4 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Wire router**

```typescript
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { InsightsPage } from './pages/Insights';
import { ChatPage } from './pages/Chat';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create empty page stubs for each (just `export function Xpage() { return <div>X</div>; }`) so the build succeeds:

```typescript
// frontend/src/pages/Dashboard.tsx
export function DashboardPage() { return <h2 className="text-xl">Dashboard</h2>; }
// frontend/src/pages/Upload.tsx
export function UploadPage() { return <h2 className="text-xl">Upload</h2>; }
// frontend/src/pages/Insights.tsx
export function InsightsPage() { return <h2 className="text-xl">Insights</h2>; }
// frontend/src/pages/Chat.tsx
export function ChatPage() { return <h2 className="text-xl">Chat</h2>; }
```

Delete unused `App.tsx` and Vite default assets (`App.css`, logo SVGs).

- [ ] **Step 6: Verify**

```bash
cd frontend && npm run dev
```
Open http://localhost:5173. Expected: dark layout with sidebar (or bottom nav if window <768px), 4 routes navigable.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): API client, router, sidebar/bottom-nav layout with route transitions"
```

---

## Phase 6 — Frontend pages

### Task 16: Dashboard page

**Files:**
- Create: `frontend/src/components/MonthSelector.tsx`, `frontend/src/components/SummaryCards.tsx`, `frontend/src/components/CategoryChart.tsx`, `frontend/src/components/TransactionList.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: MonthSelector**

```typescript
// frontend/src/components/MonthSelector.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MonthRef } from '../lib/types';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function MonthSelector({ value, onChange }: { value: MonthRef; onChange: (v: MonthRef) => void }) {
  const [options, setOptions] = useState<MonthRef[]>([]);
  useEffect(() => { api.months().then(setOptions).catch(() => setOptions([])); }, []);
  const all = options.length ? options : [value];
  return (
    <select className="bg-card text-slate-100 border border-slate-700 rounded px-3 py-2"
      value={`${value.ano}-${value.mes}`}
      onChange={(e) => { const [a, m] = e.target.value.split('-').map(Number); onChange({ ano: a, mes: m }); }}>
      {all.map((o) => (
        <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>{MESES[o.mes - 1]} {o.ano}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: SummaryCards (with framer animation)**

```typescript
// frontend/src/components/SummaryCards.tsx
import { motion } from 'framer-motion';
import type { Summary } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SummaryCards({ data }: { data: Summary }) {
  const cards = [
    { label: 'Entradas', value: data.totalEntrada, color: 'text-emerald-400' },
    { label: 'Gastos', value: data.totalGasto, color: 'text-rose-400' },
    { label: 'Saldo', value: data.saldo, color: data.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <motion.div key={c.label}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.2 }}
          className="bg-card rounded-lg p-4 border border-slate-700">
          <div className="text-slate-400 text-sm">{c.label}</div>
          <div className={`text-2xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}</div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: CategoryChart (recharts horizontal bars)**

```typescript
// frontend/src/components/CategoryChart.tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Summary } from '../lib/types';

export function CategoryChart({ data }: { data: Summary['porCategoria'] }) {
  const chartData = data.map((d) => ({ categoria: d.categoria, gasto: Math.abs(d.total) }));
  return (
    <div className="bg-card rounded-lg p-4 border border-slate-700 h-72">
      <h3 className="text-slate-300 mb-2">Gastos por categoria</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="categoria" stroke="#94a3b8" tick={{ fontSize: 12 }} width={90} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
          <Bar dataKey="gasto" fill="#38bdf8" radius={[0, 4, 4, 0]} animationDuration={300} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: TransactionList (responsive — table on md+, cards on mobile)**

```typescript
// frontend/src/components/TransactionList.tsx
import { useState } from 'react';
import { api } from '../lib/api';
import type { Transaction } from '../lib/types';

const CATEGORIAS = ['Alimentação','Transporte','Saúde','Lazer','Educação','Moradia','Compras','Outros'];
const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

export function TransactionList({ items, onChange }: { items: Transaction[]; onChange: () => void }) {
  const [updating, setUpdating] = useState<string | null>(null);
  const change = async (id: string, categoria: string) => {
    setUpdating(id);
    try { await api.updateCategoria(id, categoria); onChange(); } finally { setUpdating(null); }
  };

  return (
    <div className="bg-card rounded-lg p-4 border border-slate-700">
      <h3 className="text-slate-300 mb-2">Transações</h3>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left">
            <tr><th className="py-1">Data</th><th>Descrição</th><th className="text-right">Valor</th><th>Categoria</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-700">
                <td className="py-2">{fmtDate(t.data)}</td>
                <td>{t.descricao}</td>
                <td className={`text-right ${t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmtMoney(t.valor)}</td>
                <td>
                  <select disabled={updating === t.id} value={t.categoria}
                    onChange={(e) => change(t.id, e.target.value)}
                    className="bg-slate-700 rounded px-2 py-1 text-xs">
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="border border-slate-700 rounded p-2">
            <div className="flex justify-between text-xs text-slate-400"><span>{fmtDate(t.data)}</span>
              <span className={t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}>{fmtMoney(t.valor)}</span></div>
            <div className="text-sm mt-1">{t.descricao}</div>
            <select value={t.categoria} disabled={updating === t.id}
              onChange={(e) => change(t.id, e.target.value)}
              className="bg-slate-700 rounded px-2 py-1 text-xs mt-1 w-full">
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Dashboard page**

```typescript
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import { SummaryCards } from '../components/SummaryCards';
import { CategoryChart } from '../components/CategoryChart';
import { TransactionList } from '../components/TransactionList';
import type { Summary, Transaction, MonthRef } from '../lib/types';

export function DashboardPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [list, setList] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([api.summary(ref.mes, ref.ano), api.listTransactions(ref.mes, ref.ano)])
      .then(([s, l]) => { setSummary(s); setList(l.slice(0, 10)); })
      .catch((e) => setError(friendlyError(e)));
  };
  useEffect(load, [ref.mes, ref.ano]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <MonthSelector value={ref} onChange={setRef} />
      </div>
      {error && <div className="bg-rose-900/40 border border-rose-700 p-3 rounded">{error}</div>}
      {summary && <SummaryCards data={summary} />}
      {summary && summary.porCategoria.length > 0 && <CategoryChart data={summary.porCategoria} />}
      <TransactionList items={list} onChange={load} />
    </div>
  );
}
```

- [ ] **Step 6: Manual test**

Backend running with seeded transactions (from earlier upload). Open http://localhost:5173, switch month, verify cards animate in, chart renders, list is editable.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): dashboard page with cards, chart, transaction list"
```

---

### Task 17: Upload page

**Files:**
- Create: `frontend/src/pages/Upload.tsx`

- [ ] **Step 1: Implement**

```typescript
// frontend/src/pages/Upload.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { api, friendlyError } from '../lib/api';
import type { Transaction } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api.uploadFile(files[0]);
      setResult(r.transactions);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'], 'application/pdf': ['.pdf'] }, multiple: false,
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h2 className="text-2xl font-bold">Upload de extrato</h2>
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 min-h-[200px] flex items-center justify-center text-center cursor-pointer transition-colors touch-manipulation
          ${isDragActive ? 'border-accent bg-accent/10' : 'border-slate-700 hover:border-slate-500'}`}>
        <input {...getInputProps()} />
        <div>
          <div className="text-4xl mb-2">⬆️</div>
          <p className="text-slate-300">{isDragActive ? 'Solte o arquivo' : 'Arraste um CSV ou PDF aqui ou toque para selecionar'}</p>
          <p className="text-xs text-slate-500 mt-1">CSV: data, descricao, valor — PDF com texto nativo</p>
        </div>
      </div>
      {busy && <div className="bg-card rounded p-4 animate-pulse">Processando e categorizando com IA…</div>}
      {error && <div className="bg-rose-900/40 border border-rose-700 p-3 rounded">{error}</div>}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-slate-700 rounded p-4">
          <h3 className="font-semibold mb-2">{result.length} transações importadas</h3>
          <ul className="text-sm divide-y divide-slate-700">
            {result.slice(0, 8).map((t) => (
              <li key={t.id} className="py-1 flex justify-between gap-2">
                <span className="text-slate-300 truncate">{t.descricao}</span>
                <span className="text-xs text-slate-400">{t.categoria}</span>
                <span className={t.valor < 0 ? 'text-rose-400' : 'text-emerald-400'}>{fmt(t.valor)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

Drop a CSV. Expected: progress, then result card appears with categorized transactions. Dashboard reflects new data.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Upload.tsx
git commit -m "feat(frontend): upload page with dropzone and result preview"
```

---

### Task 18: Insights page

**Files:**
- Create: `frontend/src/pages/Insights.tsx`

- [ ] **Step 1: Implement**

```typescript
// frontend/src/pages/Insights.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, friendlyError } from '../lib/api';
import { MonthSelector } from '../components/MonthSelector';
import type { MonthRef } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function InsightsPage() {
  const today = new Date();
  const [ref, setRef] = useState<MonthRef>({ mes: today.getMonth() + 1, ano: today.getFullYear() });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [forecast, setForecast] = useState<{ texto: string; valorEstimado: number | null } | null>(null);
  const [busy, setBusy] = useState<'analyze' | 'forecast' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'analyze' | 'forecast') => {
    setBusy(kind); setError(null);
    try {
      if (kind === 'analyze') setAnalysis((await api.analyze(ref.mes, ref.ano)).texto);
      else setForecast(await api.forecast(ref.mes, ref.ano));
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Insights</h2>
        <MonthSelector value={ref} onChange={setRef} />
      </div>
      {error && <div className="bg-rose-900/40 border border-rose-700 p-3 rounded">{error}</div>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => run('analyze')} disabled={busy !== null}
          className="bg-accent text-slate-900 font-semibold px-4 py-2 rounded disabled:opacity-50">
          {busy === 'analyze' ? 'Analisando…' : 'Gerar análise'}
        </button>
        <button onClick={() => run('forecast')} disabled={busy !== null}
          className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50">
          {busy === 'forecast' ? 'Prevendo…' : 'Prever próximo mês'}
        </button>
      </div>
      {analysis && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-slate-700 rounded p-4 whitespace-pre-line">{analysis}</motion.div>
      )}
      {forecast && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-slate-700 rounded p-4">
          <div className="text-sm text-slate-400">Estimativa para o próximo mês</div>
          {forecast.valorEstimado !== null &&
            <div className="text-2xl font-bold text-accent">{fmt(forecast.valorEstimado)}</div>}
          <div className="mt-2 whitespace-pre-line">{forecast.texto}</div>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

Click "Gerar análise" → text appears. Click "Prever próximo mês" → estimate card appears.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Insights.tsx
git commit -m "feat(frontend): insights page with analysis and forecast"
```

---

### Task 19: Chat page

**Files:**
- Create: `frontend/src/pages/Chat.tsx`

- [ ] **Step 1: Implement**

```typescript
// frontend/src/pages/Chat.tsx
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, friendlyError } from '../lib/api';

type Msg = { role: 'user' | 'assistant'; content: string };

export function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: Msg = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput(''); setBusy(true); setError(null);
    try {
      const r = await api.chat(text, [...messages, userMsg].slice(-10));
      setMessages((m) => [...m, { role: 'assistant', content: r.resposta }]);
    } catch (e) { setError(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-2rem)] max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Chat financeiro</h2>
      <div className="flex-1 bg-card border border-slate-700 rounded p-3 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0 && <div className="text-slate-500 text-sm">Pergunte sobre seus gastos, dicas ou tendências.</div>}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line
                ${m.role === 'user' ? 'self-end bg-accent text-slate-900' : 'self-start bg-slate-700'}`}>
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && <div className="self-start bg-slate-700 rounded-lg px-3 py-2 text-sm animate-pulse">Pensando…</div>}
        <div ref={endRef} />
      </div>
      {error && <div className="bg-rose-900/40 border border-rose-700 p-2 rounded mt-2 text-sm">{error}</div>}
      <div className="flex gap-2 mt-2 sticky bottom-0">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()} disabled={busy}
          placeholder="Pergunte algo…"
          className="flex-1 bg-card border border-slate-700 rounded px-3 py-2 outline-none focus:border-accent" />
        <button onClick={send} disabled={busy || !input.trim()}
          className="bg-accent text-slate-900 font-semibold px-4 rounded disabled:opacity-50">
          Enviar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

Send a message ("Onde estou gastando mais?"). Expected: user bubble appears immediately, "Pensando…" placeholder, then assistant reply slides in.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Chat.tsx
git commit -m "feat(frontend): chat page with animated messages and history context"
```

---

## Phase 7 — Polish

### Task 20: README + final smoke test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# FinanceAi

Aplicativo financeiro pessoal local. Stack: NestJS + PostgreSQL no backend, React + Vite + Tailwind no frontend, OpenRouter para IA.

## Pré-requisitos
- Node 20+
- PostgreSQL 14+ rodando local
- API key do OpenRouter (https://openrouter.ai/keys)

## Setup

### Banco
```bash
psql -U postgres -c "CREATE DATABASE financeai"
```

### Backend
```bash
cd backend
cp .env.example .env  # edite OPENROUTER_API_KEY e DATABASE_URL
npm install
npm run migration:run
npm run start:dev
```
Backend roda em http://localhost:3001.

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Frontend roda em http://localhost:5173.

## Uso
1. Abra http://localhost:5173
2. Vá em Upload e envie um CSV (`data,descricao,valor`) ou PDF de extrato
3. Veja o Dashboard atualizar com categorias geradas pela IA
4. Use Insights para análise/previsão e Chat para perguntas livres

## Testes
```bash
cd backend && npm test
```

## Notas
- Cota gratuita do OpenRouter: 200 req/dia. Cada upload usa ~1 req.
- PDFs escaneados (sem texto) não são suportados — converta para CSV.
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && npm test
```
Expected: all suites pass.

- [ ] **Step 3: End-to-end smoke**

1. Backend running, frontend running.
2. Upload CSV `extrato.csv` → check 3 transactions show in upload result.
3. Dashboard `/` → cards show totals, chart shows bars.
4. Edit category in transaction list → page updates.
5. Insights `/insights` → click "Gerar análise" → text appears.
6. Chat `/chat` → ask "Como economizar?" → reply appears.
7. Resize browser to <768px → bottom nav appears, layout reflows to single column.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage"
```

---

## Done

The app is functional with:
- CSV/PDF ingestion (heuristic + AI fallback)
- AI categorization with model fallback (401/429 handled)
- Dashboard with animated cards, horizontal bar chart, editable transactions
- AI insights (analysis, forecast)
- Chat with month context
- Mobile-responsive layout (sidebar ↔ bottom nav)
- Backend tests for parsers, services, OpenRouter client

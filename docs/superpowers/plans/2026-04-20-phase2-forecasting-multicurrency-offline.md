# Phase 2 — Forecasting, Multi-currency, Offline Queue

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add forecasting UI to the planning page, multi-currency transaction support with auto-conversion, and a resilient offline queue for transaction creation.

**Architecture:** Frontend-only forecasting (backend endpoints already exist). Multi-currency adds two backend columns + a lightweight exchange-rate service fetching from AwesomeAPI. Offline queue uses IndexedDB + the `online` event to flush pending transactions.

**Tech Stack:** React 19, TypeScript, NestJS, TypeORM, SQLite, Recharts (already installed), AwesomeAPI (free, no key).

**Note:** Receipt OCR scan (spec item 2.3) is already fully implemented — skipped.

**Working directory:** `C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2`

---

## File Map

| Action | File |
|--------|------|
| **Create** | `frontend/src/pages/Forecast.tsx` |
| **Create** | `frontend/src/lib/offlineQueue.ts` |
| **Create** | `backend/src/exchange-rate/exchange-rate.entity.ts` |
| **Create** | `backend/src/exchange-rate/exchange-rate.service.ts` |
| **Create** | `backend/src/exchange-rate/exchange-rate.module.ts` |
| **Modify** | `frontend/src/pages/Planejamento.tsx` |
| **Modify** | `frontend/src/pages/NewTransaction.tsx` |
| **Modify** | `frontend/src/lib/api.ts` |
| **Modify** | `frontend/src/lib/types.ts` |
| **Modify** | `backend/src/transactions/entities/transaction.entity.ts` |
| **Modify** | `backend/src/transactions/dto/create-transaction.dto.ts` |
| **Modify** | `backend/src/transactions/transactions.service.ts` |
| **Modify** | `backend/src/app.module.ts` |

---

## Task 1: Forecasting tab in Planejamento

**Files:**
- Create: `frontend/src/pages/Forecast.tsx`
- Modify: `frontend/src/pages/Planejamento.tsx`

- [ ] **Step 1.1: Create `Forecast.tsx` page**

```tsx
// frontend/src/pages/Forecast.tsx
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { ForecastNext } from '../lib/types';

function fmt(v: number) {
  return Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ForecastPage({ mes, ano }: { mes: number; ano: number }) {
  const [data, setData] = useState<ForecastNext | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.forecastNext(mes, ano),
      api.forecast(mes, ano).catch(() => null),
    ])
      .then(([next, ai]) => {
        setData(next);
        setAiText(ai?.texto ?? null);
      })
      .catch(() => setError('Não foi possível carregar a previsão.'))
      .finally(() => setLoading(false));
  }, [mes, ano]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculando previsão...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-rose-300 text-sm py-8">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    );
  }

  if (!data) return null;

  const proj = data.proximoMes;
  const projSaldo = proj ? proj.totalEntrada - Math.abs(proj.totalGasto) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Media section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted uppercase tracking-wider">Média de gastos (6 meses)</span>
          <span className="text-2xl font-bold text-rose-300 tabular-nums">{fmt(data.mediaGasto)}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted uppercase tracking-wider">Média de entradas (6 meses)</span>
          <span className="text-2xl font-bold text-emerald-300 tabular-nums">{fmt(data.mediaEntrada)}</span>
        </div>
      </div>

      {/* Next month projection */}
      {proj && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="font-semibold text-slate-200">Projeção para {proj.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Gastos previstos</span>
              <span className="text-lg font-bold text-rose-300 tabular-nums">{fmt(proj.totalGasto)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Entradas previstas</span>
              <span className="text-lg font-bold text-emerald-300 tabular-nums">{fmt(proj.totalEntrada)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Saldo previsto</span>
              <div className="flex items-center gap-1">
                {projSaldo !== null && projSaldo > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : projSaldo !== null && projSaldo < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-muted" />
                )}
                <span className={`text-lg font-bold tabular-nums ${
                  projSaldo !== null && projSaldo >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {projSaldo !== null ? fmt(projSaldo) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI text forecast */}
      {aiText && (
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
          <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Análise da IA
          </span>
          <p className="text-sm text-slate-300 leading-relaxed">{aiText}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1.2: Add "Previsão" tab to `Planejamento.tsx`**

Add import at top:
```tsx
import { TrendingUp } from 'lucide-react';
import { ForecastPage } from './Forecast';
```

Add tab to `TABS` array (after 'goals'):
```tsx
{ id: 'forecast', label: 'Previsão', icon: TrendingUp },
```

Add tab content in the render block (after `{active === 'goals' && <GoalsPage />}`):
```tsx
{active === 'forecast' && <ForecastPage mes={new Date().getMonth() + 1} ano={new Date().getFullYear()} />}
```

- [ ] **Step 1.3: Build and verify**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2/frontend && npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 1.4: Commit**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2
git add frontend/src/pages/Forecast.tsx frontend/src/pages/Planejamento.tsx
git commit -m "feat: add Previsão tab to Planejamento with 6-month forecast"
```

---

## Task 2: Multi-currency support — Backend

**Files:**
- Create: `backend/src/exchange-rate/exchange-rate.entity.ts`
- Create: `backend/src/exchange-rate/exchange-rate.service.ts`
- Create: `backend/src/exchange-rate/exchange-rate.module.ts`
- Modify: `backend/src/transactions/entities/transaction.entity.ts`
- Modify: `backend/src/transactions/dto/create-transaction.dto.ts`
- Modify: `backend/src/transactions/transactions.service.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 2.1: Create ExchangeRate entity**

```typescript
// backend/src/exchange-rate/exchange-rate.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'varchar', length: 8 })
  currency: string; // e.g. 'USD', 'EUR'

  @Column({ type: 'numeric', precision: 16, scale: 6, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  rate: number; // how many BRL per 1 unit of currency

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD
}
```

- [ ] **Step 2.2: Create ExchangeRateService**

```typescript
// backend/src/exchange-rate/exchange-rate.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';

const AWESOME_API = 'https://economia.awesomeapi.com.br/json/last';
const SUPPORTED = ['USD', 'EUR', 'GBP', 'ARS'];

@Injectable()
export class ExchangeRateService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly repo: Repository<ExchangeRate>,
  ) {}

  async getRate(currency: string): Promise<number> {
    if (currency === 'BRL') return 1;
    const today = new Date().toISOString().slice(0, 10);
    const cached = await this.repo.findOne({ where: { currency, date: today } });
    if (cached) return cached.rate;
    return this.fetchAndCache(currency, today);
  }

  private async fetchAndCache(currency: string, date: string): Promise<number> {
    try {
      const pair = `${currency}-BRL`;
      const res = await fetch(`${AWESOME_API}/${pair}`);
      const json = await res.json();
      const key = `${currency}BRL`;
      const rate = Number(json[key]?.bid ?? json[key]?.ask ?? 0);
      if (rate > 0) {
        await this.repo.upsert({ currency, rate, date }, ['currency', 'date']);
        return rate;
      }
    } catch {
      // fall through to fallback
    }
    // Fallback: use most recent stored rate
    const latest = await this.repo.findOne({ where: { currency }, order: { date: 'DESC' } });
    return latest?.rate ?? 1;
  }

  async convertToBrl(amount: number, currency: string): Promise<number> {
    if (currency === 'BRL') return amount;
    const rate = await this.getRate(currency);
    return amount * rate;
  }

  getSupportedCurrencies(): string[] {
    return ['BRL', ...SUPPORTED];
  }
}
```

- [ ] **Step 2.3: Create ExchangeRateModule**

```typescript
// backend/src/exchange-rate/exchange-rate.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate])],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}
```

- [ ] **Step 2.4: Add `currency` and `originalAmount` columns to Transaction entity**

In `backend/src/transactions/entities/transaction.entity.ts`, after the `valor` column, add:

```typescript
@Column({ type: 'varchar', length: 8, default: 'BRL' })
currency: string;

@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, name: 'original_amount',
  transformer: { to: (v: number | null) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
originalAmount: number | null;
```

- [ ] **Step 2.5: Update CreateTransactionDto**

In `backend/src/transactions/dto/create-transaction.dto.ts`, add:

```typescript
@IsOptional()
@IsString()
currency?: string;

@IsOptional()
@IsNumber()
originalAmount?: number;
```

(Add `IsOptional`, `IsString`, `IsNumber` to existing imports from `class-validator`.)

- [ ] **Step 2.6: Update TransactionsService to auto-convert**

In `backend/src/transactions/transactions.service.ts`:

1. Inject `ExchangeRateService` in the constructor:
```typescript
constructor(
  @InjectRepository(Transaction) private repo: Repository<Transaction>,
  // ... existing deps ...
  private readonly exchangeRateService: ExchangeRateService,
) {}
```

2. Import `ExchangeRateService` at the top of the file.

3. In `createManual` (or equivalent create method), after receiving the DTO, before saving:
```typescript
const currency = dto.currency ?? 'BRL';
let valor = dto.valor;
let originalAmount: number | null = null;

if (currency !== 'BRL' && dto.originalAmount != null) {
  originalAmount = dto.originalAmount;
  valor = await this.exchangeRateService.convertToBrl(dto.originalAmount, currency);
  // Preserve sign from the original valor direction
  if (dto.valor < 0) valor = -Math.abs(valor);
}
```

Then set `tx.currency = currency` and `tx.originalAmount = originalAmount` on the entity before save.

- [ ] **Step 2.7: Register ExchangeRateModule in AppModule**

In `backend/src/app.module.ts`:
- Add `ExchangeRate` to the TypeORM entities array (or let `synchronize: true` handle it)
- Import `ExchangeRateModule` and add to `imports` array
- Add `ExchangeRateModule` to `TransactionsModule` imports so the service is available

- [ ] **Step 2.8: Build backend**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2/backend && npm run build 2>&1 | tail -10
```

Expected: zero TypeScript errors.

- [ ] **Step 2.9: Commit backend**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2
git add backend/src/exchange-rate/ backend/src/transactions/entities/transaction.entity.ts backend/src/transactions/dto/create-transaction.dto.ts backend/src/transactions/transactions.service.ts backend/src/app.module.ts
git commit -m "feat: add multi-currency support with AwesomeAPI auto-conversion"
```

---

## Task 3: Multi-currency — Frontend

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/NewTransaction.tsx`

- [ ] **Step 3.1: Update Transaction type**

In `frontend/src/lib/types.ts`, find the `Transaction` type and add two optional fields:
```typescript
currency?: string;        // 'BRL', 'USD', etc. — undefined means BRL
originalAmount?: number | null;  // amount in the original currency
```

- [ ] **Step 3.2: Update createManual API call**

In `frontend/src/lib/api.ts`, find `createManual` and add `currency` and `originalAmount` to its parameter type:
```typescript
createManual: (data: {
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  installments?: number;
  accountId?: string | null;
  isRecurring?: boolean;
  currency?: string;
  originalAmount?: number | null;
}) => http<{ saved: Transaction | null; skipped: number }>('/transactions/manual', { ... })
```

(Match the existing signature pattern in the file.)

- [ ] **Step 3.3: Add currency selector to NewTransaction.tsx**

Add `currency` state after `valorSigned`:
```tsx
const [currency, setCurrency] = useState('BRL');
const [originalAmount, setOriginalAmount] = useState('');
```

Add currency selector UI after the valor block:
```tsx
{/* Moeda */}
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted uppercase tracking-wider">Moeda</label>
  <select
    value={currency}
    onChange={(e) => { setCurrency(e.target.value); setOriginalAmount(''); }}
    className="bg-bg-soft border border-border rounded-xl px-3 py-2 text-sm text-slate-100 cursor-pointer focus:border-accent focus:outline-none"
  >
    {['BRL', 'USD', 'EUR', 'GBP', 'ARS'].map((c) => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>

{/* Valor original (se moeda != BRL) */}
{currency !== 'BRL' && (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-muted uppercase tracking-wider">Valor em {currency}</label>
    <div className="flex items-center gap-2 bg-bg-soft border border-border rounded-xl px-4 py-3 focus-within:border-accent">
      <span className="text-muted text-sm">{currency}</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={originalAmount}
        onChange={(e) => setOriginalAmount(e.target.value)}
        className="flex-1 bg-transparent text-slate-100 tabular-nums outline-none text-sm"
      />
    </div>
    <p className="text-xs text-muted">O valor em BRL será calculado automaticamente na conversão.</p>
  </div>
)}
```

In the submit function, pass `currency` and `originalAmount` to `api.createManual`:
```tsx
const parsedOriginal = currency !== 'BRL' && originalAmount
  ? Number(originalAmount.replace(',', '.'))
  : null;

await api.createManual({
  // ... existing fields ...
  ...(currency !== 'BRL' ? { currency, originalAmount: parsedOriginal } : {}),
});
```

Reset in success handler:
```tsx
setCurrency('BRL');
setOriginalAmount('');
```

- [ ] **Step 3.4: Show original currency in transaction lists**

In `frontend/src/components/TransactionList.tsx` (or wherever transaction items are rendered), find where `valor` is displayed. After the BRL amount, add:

```tsx
{tx.currency && tx.currency !== 'BRL' && tx.originalAmount != null && (
  <span className="text-xs text-muted ml-1">
    ({tx.currency} {Math.abs(tx.originalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
  </span>
)}
```

- [ ] **Step 3.5: Build frontend**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2/frontend && npm run build
```

Expected: zero errors.

- [ ] **Step 3.6: Commit frontend**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/pages/NewTransaction.tsx frontend/src/components/TransactionList.tsx
git commit -m "feat: add currency selector and original amount display in frontend"
```

---

## Task 4: Offline transaction queue

**Files:**
- Create: `frontend/src/lib/offlineQueue.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 4.1: Create `offlineQueue.ts`**

```typescript
// frontend/src/lib/offlineQueue.ts

const DB_NAME = 'financeai-offline';
const STORE = 'pending-transactions';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type PendingTransaction = {
  payload: Record<string, unknown>;
  timestamp: number;
};

export async function enqueue(payload: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ payload, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAll(): Promise<{ key: IDBValidKey; item: PendingTransaction }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const result: { key: IDBValidKey; item: PendingTransaction }[] = [];
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { result.push({ key: cursor.key, item: cursor.value }); cursor.continue(); }
      else resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function remove(key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4.2: Wrap `createManual` in `api.ts` with offline detection**

In `frontend/src/lib/api.ts`, import at top:
```typescript
import { enqueue } from './offlineQueue';
```

Find `createManual` in the `api` object and wrap it:
```typescript
createManual: async (data: { ... }) => {
  if (!navigator.onLine) {
    await enqueue(data as Record<string, unknown>);
    // Return mock success so the UI flow completes normally
    return { saved: null, skipped: 0, queued: true } as any;
  }
  return http<{ saved: Transaction | null; skipped: number }>('/transactions/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
},
```

Add a `flushQueue` export to the api object:
```typescript
flushQueue: async (): Promise<{ synced: number; failed: number }> => {
  const { getAll, remove } = await import('./offlineQueue');
  const items = await getAll();
  let synced = 0;
  let failed = 0;
  for (const { key, item } of items) {
    try {
      await http<unknown>('/transactions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      await remove(key);
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
},
```

- [ ] **Step 4.3: Add online event listener to flush queue on app startup**

In `frontend/src/main.tsx` (or `App.tsx`), add:
```typescript
import { api } from './lib/api';

window.addEventListener('online', () => {
  api.flushQueue().then(({ synced }) => {
    if (synced > 0) console.info(`[offline-sync] ${synced} transações sincronizadas`);
  });
});

// Also flush on startup in case there are pending items
if (navigator.onLine) {
  api.flushQueue().catch(() => {});
}
```

- [ ] **Step 4.4: Show pending badge in the header**

Find the header/navbar component (likely `frontend/src/components/` — look for the nav). Add a pending count indicator:

```tsx
// Import at top of nav component
import { useEffect, useState } from 'react';
import { getPendingCount } from '../lib/offlineQueue';

// Inside the component
const [pendingCount, setPendingCount] = useState(0);

useEffect(() => {
  const update = () => getPendingCount().then(setPendingCount);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);

// In JSX, where connection status makes sense:
{pendingCount > 0 && (
  <span className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full">
    {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
  </span>
)}
```

- [ ] **Step 4.5: Show feedback in NewTransaction when saved offline**

In `NewTransaction.tsx` submit handler, detect the offline case:
```tsx
const result = await api.createManual({ ... });
if ((result as any).queued) {
  setSuccess({ mes: m, ano: y });
  // Optionally show a different message
  setError(null);
  // Note: success message stays the same, transaction was queued
  return;
}
```

- [ ] **Step 4.6: Build and verify**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2/frontend && npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 4.7: Commit**

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2
git add frontend/src/lib/offlineQueue.ts frontend/src/lib/api.ts frontend/src/main.tsx
git commit -m "feat: add offline transaction queue with IndexedDB sync"
```

---

## Phase 2 Complete — Push and create PR

```bash
cd C:/Users/claud/Desktop/FinanceAi/.worktrees/phase2
git push -u origin feature/phase2

gh pr create \
  --title "feat: Phase 2 — Forecasting, Multi-currency, Offline queue" \
  --base main \
  --body "..."
```

Verify end-to-end:
1. Planejamento → aba "Previsão" exibe média + projeção do próximo mês
2. Nova transação em USD → valor BRL calculado automaticamente
3. Desligar rede → criar transação → badge "1 pendente" aparece
4. Religar rede → transação sincroniza automaticamente

# Phase 1 — AmountInput + Split Fix + Dashboard Insights

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile string-based sign system with a reusable `AmountInput` toggle component, fix split for negative transactions, and add automatic insights to the dashboard.

**Architecture:** New shared `AmountInput` component holds sign state internally and exposes a single signed `number` via `onChange`. All amount fields across the app migrate to it. `DashboardInsights` is a self-contained component that fetches its own data and renders 0–3 insight chips.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, existing `api` client.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `frontend/src/components/AmountInput.tsx` |
| **Create** | `frontend/src/components/DashboardInsights.tsx` |
| **Modify** | `frontend/src/pages/NewTransaction.tsx` |
| **Modify** | `frontend/src/components/TransactionEditModal.tsx` |
| **Modify** | `frontend/src/pages/Dashboard.tsx` |

---

## Task 1: Create `AmountInput` component

**Files:**
- Create: `frontend/src/components/AmountInput.tsx`

- [ ] **Step 1.1: Create the component**

```tsx
// frontend/src/components/AmountInput.tsx
import { useState, useEffect } from 'react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  defaultSign?: '+' | '-';
  placeholder?: string;
  wrapperClassName?: string;
  inputClassName?: string;
}

function parseDisplayToAbs(display: string): number {
  let raw = display.replace(/[^\d,.]/g, '');
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  }
  return parseFloat(raw) || 0;
}

export function AmountInput({
  value,
  onChange,
  defaultSign = '-',
  placeholder = '0,00',
  wrapperClassName,
  inputClassName,
}: AmountInputProps) {
  const [sign, setSign] = useState<'+' | '-'>(() =>
    value < 0 ? '-' : value > 0 ? '+' : defaultSign
  );
  const [display, setDisplay] = useState(() =>
    value !== 0 ? Math.abs(value).toFixed(2).replace('.', ',') : ''
  );

  useEffect(() => {
    if (value === 0) return;
    setSign(value < 0 ? '-' : '+');
    setDisplay(Math.abs(value).toFixed(2).replace('.', ','));
  }, [value]);

  const emit = (disp: string, s: '+' | '-') => {
    const abs = parseDisplayToAbs(disp);
    onChange(s === '-' ? -abs : abs);
  };

  return (
    <div className={`flex items-center gap-2 ${wrapperClassName ?? ''}`}>
      <button
        type="button"
        onClick={() => {
          const next: '+' | '-' = sign === '-' ? '+' : '-';
          setSign(next);
          emit(display, next);
        }}
        title={sign === '-' ? 'Gasto — clique para mudar para entrada' : 'Entrada — clique para mudar para gasto'}
        className={`w-9 h-9 rounded-lg font-bold text-base flex items-center justify-center border-2 transition-colors shrink-0 ${
          sign === '-'
            ? 'bg-rose-500/20 border-rose-500/60 text-rose-400 hover:bg-rose-500/30'
            : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/30'
        }`}
      >
        {sign}
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          setDisplay(e.target.value);
          emit(e.target.value, sign);
        }}
        className={`flex-1 min-w-0 bg-transparent outline-none tabular-nums ${inputClassName ?? ''}`}
      />
    </div>
  );
}
```

- [ ] **Step 1.2: Verify it renders without error**

Run: `cd frontend && npm run build`
Expected: no TypeScript errors. Fix any type issues before continuing.

- [ ] **Step 1.3: Commit**

```bash
git add frontend/src/components/AmountInput.tsx
git commit -m "feat: add AmountInput component with +/- sign toggle"
```

---

## Task 2: Migrate `NewTransaction.tsx` to use `AmountInput`

**Files:**
- Modify: `frontend/src/pages/NewTransaction.tsx`

- [ ] **Step 2.1: Replace `tipo` + `valor` states with a single `valorSigned` number**

At the top of `NewTransactionPage` (lines 24–27), replace:
```tsx
const [tipo, setTipo] = useState<'gasto' | 'entrada'>('gasto');
// ...
const [valor, setValor] = useState('');
```

With:
```tsx
const [valorSigned, setValorSigned] = useState(0);
```

Immediately after, add a derived variable so conditional UI (`parcelamento` only for gastos) still works:
```tsx
const tipo = valorSigned > 0 ? 'entrada' : 'gasto';
```

- [ ] **Step 2.2: Update the submit function**

Remove the parsing block and `valorFinal` computation (lines 108–123):
```tsx
// REMOVE this entire block:
let raw = valor.replace(/[^\d,.-]/g, '');
if (raw.includes(',') && raw.includes('.')) { ... }
const v = Number(raw);
if (Number.isNaN(v) || v === 0) return setError('Valor inválido. Use vírgula para centavos.');
const valorFinal = tipo === 'gasto' ? -Math.abs(v) : Math.abs(v);
```

Replace with:
```tsx
if (valorSigned === 0) return setError('Valor inválido.');
```

Change the API call to use `valorSigned` directly (where `valor: valorFinal` was):
```tsx
valor: valorSigned,
```

In the success reset block, replace `setValor('');` with `setValorSigned(0);`.

- [ ] **Step 2.3: Update OCR and NL handlers to set `valorSigned` directly**

In the OCR handler (around line 66), replace:
```tsx
if (r.valor != null) {
  setValor(String(Math.abs(r.valor)).replace('.', ','));
  setTipo(r.valor < 0 ? 'gasto' : 'entrada');
}
```

With:
```tsx
if (r.valor != null) setValorSigned(r.valor);
```

In the NL handler (around line 88), replace:
```tsx
setValor(String(Math.abs(r.valor)));
// ...
setTipo(r.valor < 0 ? 'gasto' : 'entrada');
```

With:
```tsx
setValorSigned(r.valor);
```

- [ ] **Step 2.4: Update JSX — remove tipo toggle buttons, replace valor input**

Remove the `{/* Tipo toggle */}` block (lines 290–314):
```tsx
// REMOVE entire block:
<div className="grid grid-cols-2 gap-2">
  <button onClick={() => setTipo('gasto')} ...>...</button>
  <button onClick={() => setTipo('entrada')} ...>...</button>
</div>
```

Replace the `{/* Valor em destaque */}` input (lines 316–332) with:
```tsx
{/* Valor em destaque */}
<div>
  <label className="text-xs text-muted uppercase tracking-wider">Valor</label>
  <div className="mt-1 flex items-center gap-2 bg-bg-soft border border-border rounded-xl px-4 py-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
    <span className="text-muted text-lg">R$</span>
    <AmountInput
      value={valorSigned}
      onChange={setValorSigned}
      defaultSign="-"
      wrapperClassName="flex-1"
      inputClassName={`text-2xl font-bold tabular-nums ${tipo === 'gasto' ? 'text-rose-300' : 'text-emerald-300'}`}
    />
  </div>
</div>
```

Add the import at the top of the file:
```tsx
import { AmountInput } from '../components/AmountInput';
```

Remove `ArrowDownRight` and `ArrowUpRight` from the lucide-react import line (they are no longer used).

- [ ] **Step 2.5: Build and verify**

```bash
cd frontend && npm run build
```

Expected: no TypeScript errors. Then start the dev server and test:
- Create a new expense (toggle should default to `-`, value red)
- Click toggle → switches to `+`, value turns green
- Trigger NL parse → `valorSigned` gets set with correct sign
- Submit → transaction saved with correct sign

- [ ] **Step 2.6: Commit**

```bash
git add frontend/src/pages/NewTransaction.tsx
git commit -m "feat: migrate NewTransaction to AmountInput sign toggle"
```

---

## Task 3: Migrate `TransactionEditModal.tsx` edit mode to use `AmountInput`

**Files:**
- Modify: `frontend/src/components/TransactionEditModal.tsx`

- [ ] **Step 3.1: Replace `valor` string state with `valorNum` number state**

Replace (line 49 area, in useState declarations and useEffect):
```tsx
// REMOVE:
const [valor, setValor] = useState('');
// ...
// In useEffect line 49:
setValor(String(tx.valor));
```

Add:
```tsx
const [valorNum, setValorNum] = useState<number>(0);
// In useEffect (same block, replace setValor line):
setValorNum(tx.valor);
```

- [ ] **Step 3.2: Update the save function**

Remove the parsing block (lines 141–151):
```tsx
// REMOVE:
let raw = valor.replace(/[^\d,.-]/g, '');
if (raw.includes(',') && raw.includes('.')) { ... }
const v = Number(raw);
if (Number.isNaN(v)) throw new Error('Valor inválido');
```

Replace the `valor: v` in the API call with `valor: valorNum`.

Add a guard before `setBusy(true)`:
```tsx
if (valorNum === 0) { setError('Valor inválido.'); return; }
```

- [ ] **Step 3.3: Update the valor input JSX (edit mode, around line 423–432)**

Replace the label and input:
```tsx
// REMOVE:
<label className="flex flex-col gap-1">
  <span className="text-xs text-muted uppercase tracking-wider">Valor (negativo = gasto)</span>
  <input
    type="text"
    inputMode="decimal"
    value={valor}
    onChange={(e) => setValor(e.target.value)}
    className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
  />
</label>
```

With:
```tsx
<label className="flex flex-col gap-1">
  <span className="text-xs text-muted uppercase tracking-wider">Valor</span>
  <div className="bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
    <AmountInput
      value={valorNum}
      onChange={setValorNum}
      inputClassName="text-sm text-slate-100 tabular-nums"
    />
  </div>
</label>
```

Add the import at the top of `TransactionEditModal.tsx`:
```tsx
import { AmountInput } from './AmountInput';
```

- [ ] **Step 3.4: Build and verify**

```bash
cd frontend && npm run build
```

Then test in dev server:
- Open edit modal on a `-300` transaction → field shows `300` with `[-]` toggle
- Toggle to `+` → sends positive value on save
- Open edit modal on a `+500` transaction → field shows `500` with `[+]` toggle

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/components/TransactionEditModal.tsx
git commit -m "feat: migrate TransactionEditModal edit mode to AmountInput"
```

---

## Task 4: Fix split mode to support signed values

**Files:**
- Modify: `frontend/src/components/TransactionEditModal.tsx`

- [ ] **Step 4.1: Change `splitRows` type from string to number valor**

Replace the state declaration (line 34):
```tsx
// REMOVE:
const [splitRows, setSplitRows] = useState<{ valor: string; categoria: string; descricao: string }[]>([]);
```

With:
```tsx
const [splitRows, setSplitRows] = useState<{ valor: number; categoria: string; descricao: string }[]>([]);
```

- [ ] **Step 4.2: Update split rows initialization in useEffect**

Replace lines 61–65:
```tsx
// REMOVE:
const half = Math.abs(tx.valor) / 2;
setSplitRows([
  { valor: half.toFixed(2), categoria: tx.categoria, descricao: '' },
  { valor: half.toFixed(2), categoria: tx.categoria, descricao: '' },
]);
```

With:
```tsx
const half = tx.valor / 2;
setSplitRows([
  { valor: half, categoria: tx.categoria, descricao: '' },
  { valor: half, categoria: tx.categoria, descricao: '' },
]);
```

- [ ] **Step 4.3: Update `splitTotal` and `parentAbs`**

Replace lines 174–186:
```tsx
// REMOVE:
const splitTotal = splitRows.reduce((s, r) => {
  let raw = (r.valor || '0').replace(/[^\d,.-]/g, '');
  // ...parsing...
  return s + (Number.isNaN(n) ? 0 : n);
}, 0);
const parentAbs = Math.abs(tx.valor);
```

With:
```tsx
const splitTotal = splitRows.reduce((s, r) => s + r.valor, 0);
```

(Remove `parentAbs` — use `tx.valor` directly going forward.)

- [ ] **Step 4.4: Update `addSplitRow` and `updateSplitRow`**

Replace `addSplitRow`:
```tsx
const addSplitRow = () => {
  setSplitRows([...splitRows, { valor: 0, categoria: tx.categoria, descricao: '' }]);
};
```

Update `updateSplitRow` signature:
```tsx
const updateSplitRow = (i: number, patch: Partial<{ valor: number; categoria: string; descricao: string }>) => {
  setSplitRows(splitRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
};
```

- [ ] **Step 4.5: Update `confirmSplit` validation**

Replace lines 199–224 entirely:
```tsx
const confirmSplit = async () => {
  setError(null);
  if (splitRows.some((r) => r.valor === 0)) {
    setError('Nenhuma parcela pode ter valor zero.');
    return;
  }
  const sum = splitRows.reduce((s, r) => s + r.valor, 0);
  if (Math.abs(sum - tx.valor) > 0.01) {
    setError(`A soma (${sum.toFixed(2)}) deve ser igual ao valor original (${tx.valor.toFixed(2)}).`);
    return;
  }
  const items = splitRows.map((r) => ({
    valor: r.valor,
    categoria: r.categoria,
    descricao: r.descricao.trim() || undefined,
  }));
  setBusy(true);
  try {
    await api.splitTransaction(tx.id, items);
    onSaved();
    onClose();
  } catch (e) {
    setError(friendlyError(e));
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 4.6: Replace split row valor input with `AmountInput`**

In the split rows JSX (lines 318–325), replace the `<input>` for valor:
```tsx
// REMOVE:
<input
  type="text"
  inputMode="decimal"
  value={r.valor}
  onChange={(e) => updateSplitRow(i, { valor: e.target.value })}
  placeholder="0,00"
  className="flex-1 min-w-0 bg-bg-soft border border-border rounded-lg px-2 py-1.5 text-sm text-slate-100 tabular-nums focus:border-accent focus:outline-none"
/>
```

With:
```tsx
<div className="flex-1 min-w-0 bg-bg-soft border border-border rounded-lg px-2 py-1.5 focus-within:border-accent">
  <AmountInput
    value={r.valor}
    onChange={(v) => updateSplitRow(i, { valor: v })}
    defaultSign={tx.valor < 0 ? '-' : '+'}
    inputClassName="text-sm text-slate-100 tabular-nums w-full"
  />
</div>
```

- [ ] **Step 4.7: Update split status indicator**

Replace lines 359–371 (the status div):
```tsx
// REMOVE:
<div className={`text-xs rounded-lg p-2.5 border ${
  Math.abs(splitTotal - parentAbs) < 0.01
    ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-700/40 bg-amber-500/10 text-amber-300'
}`}>
  Total dividido:{' '}
  <span className="font-semibold tabular-nums">
    {splitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
  </span>{' '}
  /{' '}
  <span className="font-semibold tabular-nums">
    {parentAbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
  </span>
</div>
```

With:
```tsx
<div className={`text-xs rounded-lg p-2.5 border ${
  Math.abs(splitTotal - tx.valor) < 0.01
    ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-700/40 bg-amber-500/10 text-amber-300'
}`}>
  Total dividido:{' '}
  <span className="font-semibold tabular-nums">
    {splitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
  </span>{' '}
  /{' '}
  <span className="font-semibold tabular-nums">
    {tx.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
  </span>
</div>
```

- [ ] **Step 4.8: Build and verify**

```bash
cd frontend && npm run build
```

Then test in dev server:
- Open edit modal on a `-300` transaction → click Split
- Two rows appear, each with `150` and `[-]` toggle (half of -300 = -150, displayed as 150)
- Change one to 200 → sum indicator turns amber, shows mismatch
- Change back so sum = -300 → indicator turns green
- Confirm split → transaction split successfully

- [ ] **Step 4.9: Commit**

```bash
git add frontend/src/components/TransactionEditModal.tsx
git commit -m "fix: support signed values in split mode using AmountInput"
```

---

## Task 5: Create `DashboardInsights` component

**Files:**
- Create: `frontend/src/components/DashboardInsights.tsx`

- [ ] **Step 5.1: Create the component**

```tsx
// frontend/src/components/DashboardInsights.tsx
import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { api } from '../lib/api';
import type { Summary, Budget } from '../lib/types';

type Insight = { message: string; type: 'warning' | 'danger' };

function computeInsights(
  current: Summary,
  prev: Summary | null,
  budgets: Budget[],
  dayOfMonth: number
): Insight[] {
  const result: Insight[] = [];

  // Category spending increase >20% vs previous month
  if (prev && result.length < 3) {
    const prevMap = new Map(prev.porCategoria.map((c) => [c.categoria, Math.abs(c.total)]));
    for (const { categoria, total } of current.porCategoria) {
      if (result.length >= 3) break;
      const curr = Math.abs(total);
      const p = prevMap.get(categoria);
      if (p && p > 0 && curr > 0) {
        const pct = ((curr - p) / p) * 100;
        if (pct >= 20) {
          result.push({
            message: `Você gastou ${Math.round(pct)}% mais em ${categoria} este mês`,
            type: 'warning',
          });
        }
      }
    }
  }

  // Budget >80% used before day 20
  if (dayOfMonth < 20) {
    for (const b of budgets) {
      if (result.length >= 3) break;
      if (b.percentual >= 80) {
        result.push({
          message: `${b.categoria} está com ${Math.round(b.percentual)}% do orçamento usado`,
          type: b.percentual >= 100 ? 'danger' : 'warning',
        });
      }
    }
  }

  return result;
}

export function DashboardInsights({
  summary,
  mes,
  ano,
}: {
  summary: Summary;
  mes: number;
  ano: number;
}) {
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    const prevMes = mes === 1 ? 12 : mes - 1;
    const prevAno = mes === 1 ? ano - 1 : ano;
    const dayOfMonth = new Date().getDate();

    Promise.all([
      api.summary(prevMes, prevAno).catch(() => null),
      api.listBudgets(mes, ano).catch(() => [] as Budget[]),
    ]).then(([prev, budgets]) => {
      setInsights(computeInsights(summary, prev, budgets as Budget[], dayOfMonth));
    });
  }, [summary, mes, ano]);

  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {insights.map((ins, i) => (
        <div
          key={i}
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
            ins.type === 'danger'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {ins.type === 'danger' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Info className="w-4 h-4 shrink-0" />
          )}
          <span>{ins.message}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5.2: Build and verify no type errors**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
git add frontend/src/components/DashboardInsights.tsx
git commit -m "feat: add DashboardInsights component with automatic spending alerts"
```

---

## Task 6: Wire `DashboardInsights` into `Dashboard.tsx`

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 6.1: Add import**

Add to the imports section of `Dashboard.tsx`:
```tsx
import { DashboardInsights } from '../components/DashboardInsights';
```

- [ ] **Step 6.2: Render `DashboardInsights` between SummaryCards and DailyBudget**

Find line 369–373:
```tsx
) : null}

{/* ═══════════════ ALWAYS VISIBLE: Budget + Today ═══════════════ */}
{summary && <DailyBudget summary={summary} goals={goals} mes={ref.mes} ano={ref.ano} />}
```

Add `DashboardInsights` between them:
```tsx
) : null}

{summary && <DashboardInsights summary={summary} mes={ref.mes} ano={ref.ano} />}

{/* ═══════════════ ALWAYS VISIBLE: Budget + Today ═══════════════ */}
{summary && <DailyBudget summary={summary} goals={goals} mes={ref.mes} ano={ref.ano} />}
```

- [ ] **Step 6.3: Build and full verify**

```bash
cd frontend && npm run build
```

Then test in dev server:
- Dashboard loads → if there are budget alerts or category spikes vs last month, insight chips appear
- No data that triggers insights → component renders nothing (no empty space)
- Navigate to previous month with data → insights update accordingly

- [ ] **Step 6.4: Final commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: show automatic spending insights on dashboard"
```

---

## Phase 1 Complete

All tasks done. Verify end-to-end:

1. Create a transaction → toggle button works, sign correct
2. Edit a `-300` transaction → shows `300` + `[-]`, save works
3. Split a `-300` transaction → rows initialize at `-150` each, toggle per row works, sum validation uses signed values
4. Dashboard → spending alerts appear when conditions are met

Phases 2 and 3 are in separate plan documents.

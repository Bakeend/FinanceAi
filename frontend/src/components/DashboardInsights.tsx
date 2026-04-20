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

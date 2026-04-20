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

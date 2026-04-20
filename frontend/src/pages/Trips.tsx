import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Plus, X, Trash2, Save, AlertCircle } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { CategoryChip } from '../components/CategoryChip';
import type { Trip } from '../lib/types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#8B5CF6', '#a78bfa', '#9DE131', '#f472b6', '#fbbf24', '#EC4899'];

export function TripsPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api.listTrips().then(setItems).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Modo <span className="gradient-text">viagem</span>
          </h2>
          <p className="text-muted text-sm mt-1">Crie uma viagem e suas transações no período são marcadas automaticamente</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent"
        >
          <Plus className="w-4 h-4" />
          Nova viagem
        </motion.button>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Plane className="w-10 h-10 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Sem viagens. Crie uma pra começar a separar os gastos do período.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((t, idx) => (
            <TripCard key={t.id} trip={t} idx={idx} onDeleted={load} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <TripModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TripCard({ trip, idx, onDeleted }: { trip: Trip; idx: number; onDeleted: () => void }) {
  const pct = trip.orcamento ? Math.min(100, (trip.gastoTotal / trip.orcamento) * 100) : 0;
  const over = trip.orcamento ? trip.gastoTotal > trip.orcamento : false;
  const statusLabel = trip.status === 'ativa' ? 'Em andamento' : trip.status === 'futura' ? 'Futura' : 'Concluída';
  const statusColor = trip.status === 'ativa' ? 'text-emerald-300' : trip.status === 'futura' ? 'text-sky-300' : 'text-muted';

  const remove = async () => {
    if (!confirm(`Excluir a viagem "${trip.nome}"? Os gastos não são apagados — apenas a marcação.`)) return;
    await api.deleteTrip(trip.id);
    onDeleted();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
      className="relative rounded-2xl border border-border bg-card p-4 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(120% 80% at 0% 0%, ${trip.cor}60, transparent 60%)` }} />
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${trip.cor}30`, color: trip.cor }}>
            <Plane className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">{trip.nome}</div>
            <div className="text-[11px] text-muted">{trip.inicio} → {trip.fim}</div>
          </div>
        </div>
        <button onClick={remove} className="text-muted hover:text-rose-300 p-1"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="relative">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-bold tabular-nums text-rose-300">{fmt(trip.gastoTotal)}</span>
          <span className={`text-xs ${statusColor}`}>{statusLabel}{trip.status === 'ativa' ? ` · ${trip.diasRestantes}d` : ''}</span>
        </div>
        {trip.orcamento != null && (
          <>
            <div className="text-xs text-muted mt-1">de {fmt(trip.orcamento)}{over ? ' (estourado)' : ''}</div>
            <div className="mt-2 h-1.5 rounded-full bg-card-hover/50 overflow-hidden">
              <div className={`h-full ${over ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        <div className="text-[11px] text-muted mt-2">{trip.transacoes} {trip.transacoes === 1 ? 'transação' : 'transações'} · tag: <code className="text-accent">{trip.tag}</code></div>
        {trip.gastoPorCategoria.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {trip.gastoPorCategoria.slice(0, 4).map((c) => (
              <span key={c.categoria} className="inline-flex items-center gap-1 text-[10px]">
                <CategoryChip categoria={c.categoria} size="sm" />
                <span className="tabular-nums text-muted">{fmt(c.valor)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TripModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(today);
  const [fim, setFim] = useState(today);
  const [orcamento, setOrcamento] = useState('');
  const [cor, setCor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!nome.trim()) return setError('Nome obrigatório');
    if (fim < inicio) return setError('Fim precisa ser depois do início');
    setBusy(true);
    try {
      const orc = orcamento.trim() ? Number(orcamento.replace(',', '.')) : undefined;
      await api.createTrip({ nome: nome.trim(), inicio, fim, orcamento: orc, cor });
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-t-2xl md:rounded-2xl w-full max-w-md border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-slate-100">Nova viagem</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card-hover/50 flex items-center justify-center text-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Paraty 2026"
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Início</span>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Fim</span>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Orçamento (opcional)</span>
            <input inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="R$ 0,00"
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-slate-100" />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Cor</span>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-9 h-9 rounded-xl border-2 ${cor === c ? 'border-slate-100 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        {error && <div className="mt-3 text-xs text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-2">{error}</div>}
        <button onClick={save} disabled={busy}
          className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-gradient text-slate-900 font-semibold disabled:opacity-50 shadow-glow-accent">
          <Save className="w-4 h-4" />
          <span className="text-sm">{busy ? 'Salvando…' : 'Criar viagem'}</span>
        </button>
      </motion.div>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload as UploadIcon, Database, AlertCircle, CheckCircle2, FileText, Bell, BellOff } from 'lucide-react';
import { isNotificationEnabled, requestNotificationPermission, notifyNow } from '../lib/notifications';
import { api, friendlyError } from '../lib/api';

export function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(isNotificationEnabled());

  const enableNotifs = async () => {
    const ok = await requestNotificationPermission();
    setNotifOn(ok);
    if (ok) notifyNow('FinanceAi', 'Notificações ativadas 👍');
    else setError('Permissão de notificação recusada pelo navegador.');
  };

  const restore = async (file: File) => {
    if (!confirm(`Substituir o banco atual pelo conteúdo de "${file.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api.restoreBackup(file);
      setMsg(r.message);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold tracking-tight">
          Backup & <span className="gradient-text">export</span>
        </h2>
        <p className="text-muted text-sm mt-1">Salve uma cópia do seu banco ou exporte para outros formatos</p>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4 text-sm text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span>{msg}</span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-slate-200">Backup completo do banco</h3>
        </div>
        <p className="text-xs text-muted mb-3">
          Baixa o arquivo SQLite inteiro. Use pra migrar pra outro dispositivo ou guardar uma cópia de segurança.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={api.backupUrl()} download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-gradient text-slate-900 font-semibold text-sm shadow-glow-accent">
            <Download className="w-4 h-4" /> Baixar backup (.db)
          </a>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm cursor-pointer">
            <UploadIcon className="w-4 h-4" /> {busy ? 'Restaurando…' : 'Restaurar backup'}
            <input type="file" accept=".db" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {notifOn ? <Bell className="w-4 h-4 text-accent" /> : <BellOff className="w-4 h-4 text-muted" />}
          <h3 className="text-sm font-semibold text-slate-200">Notificações do navegador</h3>
        </div>
        <p className="text-xs text-muted mb-3">
          Autorize o navegador para receber alertas de vencimento de cartão, orçamento próximo do limite e lembretes. Tudo processado localmente.
        </p>
        <button onClick={enableNotifs} disabled={notifOn}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm disabled:opacity-60">
          <Bell className="w-4 h-4" />
          {notifOn ? 'Ativadas' : 'Ativar notificações'}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-slate-200">Exportar dados</h3>
        </div>
        <p className="text-xs text-muted mb-3">Formato texto legível pra abrir em outras ferramentas.</p>
        <div className="flex flex-wrap gap-2">
          <a href={api.exportUrl()} download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm">
            <Download className="w-4 h-4" /> CSV
          </a>
          <a href={api.exportXlsUrl()} download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card-hover/30 text-slate-200 text-sm">
            <Download className="w-4 h-4" /> Excel (.xls)
          </a>
        </div>
      </div>
    </div>
  );
}

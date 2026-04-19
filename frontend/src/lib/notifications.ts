/**
 * Notificações locais via Notification API.
 * Roda no main thread (não precisa de servidor de push). Agenda via setTimeout.
 */

type Scheduled = { id: string; at: number };

const scheduled: Map<string, number> = new Map();

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

export function isNotificationEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function notifyNow(title: string, body: string) {
  if (!isNotificationEnabled()) return;
  try {
    new Notification(title, { body, icon: '/icon.svg' });
  } catch { /* ignore */ }
}

export function scheduleAt(id: string, date: Date, title: string, body: string): boolean {
  if (!isNotificationEnabled()) return false;
  cancel(id);
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return false;
  // setTimeout max ~24.8 days; for longer, chain. Keep simple: limit to 7 days ahead.
  if (ms > 7 * 86400_000) return false;
  const handle = window.setTimeout(() => {
    notifyNow(title, body);
    scheduled.delete(id);
  }, ms);
  scheduled.set(id, handle);
  return true;
}

export function cancel(id: string) {
  const h = scheduled.get(id);
  if (h !== undefined) window.clearTimeout(h);
  scheduled.delete(id);
}

export function cancelAll() {
  for (const h of scheduled.values()) window.clearTimeout(h);
  scheduled.clear();
}

export function listScheduled(): Scheduled[] {
  return Array.from(scheduled.keys()).map((id) => ({ id, at: 0 }));
}

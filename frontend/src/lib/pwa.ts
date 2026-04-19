// Holds the last deferred beforeinstallprompt event so the MoreSheet "Instalar" button can use it.
// Using a tiny pub/sub so components can react to availability.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

export function onInstallAvailable(cb: (available: boolean) => void): () => void {
  listeners.add(cb);
  // fire initial
  cb(deferred !== null);
  return () => {
    listeners.delete(cb);
  };
}

function setDeferred(ev: InstallEvent | null) {
  deferred = ev;
  listeners.forEach((cb) => cb(deferred !== null));
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

export function bindInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setDeferred(e as InstallEvent);
  });
  window.addEventListener('appinstalled', () => {
    setDeferred(null);
  });
}

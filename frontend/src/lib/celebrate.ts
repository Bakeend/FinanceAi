/**
 * Brand-colored confetti + soft chime, zero deps. Uses canvas + WebAudio.
 */

type ConfettiPiece = {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  size: number; color: string; shape: 'rect' | 'circle';
};

const COLORS = ['#8B5CF6', '#EC4899', '#84CC16', '#FBBF24', '#F472B6', '#A78BFA'];

let lastFiredAt = 0;
const COOLDOWN_MS = 4000;

export function celebrate(opts?: { silent?: boolean; intensity?: 'soft' | 'medium' | 'big' }) {
  const now = Date.now();
  if (now - lastFiredAt < COOLDOWN_MS) return;
  lastFiredAt = now;

  const intensity = opts?.intensity ?? 'medium';
  const count = intensity === 'big' ? 180 : intensity === 'soft' ? 60 : 110;
  fireConfetti(count);
  if (!opts?.silent) playChime(intensity);
}

function fireConfetti(count: number) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;width:100vw;height:100vh;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
  };
  resize();

  const W = innerWidth;
  const H = innerHeight;

  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = Math.random() < 0.5;
    pieces.push({
      x: fromLeft ? -10 : W + 10,
      y: H * (0.6 + Math.random() * 0.3),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 6),
      vy: -(8 + Math.random() * 8),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() < 0.4 ? 'circle' : 'rect',
    });
  }

  const gravity = 0.3;
  const drag = 0.992;
  const start = performance.now();
  const lifeMs = 2600;

  function tick(t: number) {
    const elapsed = t - start;
    if (elapsed > lifeMs) { canvas.remove(); return; }
    ctx!.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.globalAlpha = Math.max(0, 1 - elapsed / lifeMs);
      if (p.shape === 'rect') ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { ctx!.beginPath(); ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx!.fill(); }
      ctx!.restore();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function playChime(intensity: 'soft' | 'medium' | 'big') {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const now = ac.currentTime;
    const notes = intensity === 'big' ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const startT = now + i * 0.08;
      const dur = 0.55;
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(0.16, startT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(startT);
      osc.stop(startT + dur + 0.05);
    });
    setTimeout(() => ac.close().catch(() => {}), 1500);
  } catch {
    /* silent */
  }
}

/**
 * Generate a shareable PNG of one or more transactions.
 * Uses the FinanceAi brand: dark bg, purple→pink gradient header, acid-green/hot-pink values.
 */

type Tx = { data: string; descricao: string; valor: number; categoria: string };

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

export async function renderTransactionsAsImage(
  items: Tx[],
  options: { title?: string; filename?: string } = {},
): Promise<void> {
  const title = options.title ?? 'Resumo';
  const filename = options.filename ?? 'transacoes.png';
  const padding = 36;
  const headerH = 132;
  const rowH = 64;
  const totalRowH = 96;
  const footerH = 56;
  const width = 760;
  const scale = 2;

  const total = items.reduce((s, i) => s + i.valor, 0);
  const height = headerH + items.length * rowH + totalRowH + footerH + padding;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas sem contexto');
  ctx.scale(scale, scale);

  // ===== Background =====
  ctx.fillStyle = '#0B0B0F';
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient glow
  const glow1 = ctx.createRadialGradient(width * 0.15, height * 0.1, 0, width * 0.15, height * 0.1, 380);
  glow1.addColorStop(0, 'rgba(109, 40, 217, 0.25)');
  glow1.addColorStop(1, 'rgba(109, 40, 217, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(width * 0.9, height * 0.95, 0, width * 0.9, height * 0.95, 380);
  glow2.addColorStop(0, 'rgba(236, 72, 153, 0.18)');
  glow2.addColorStop(1, 'rgba(236, 72, 153, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // ===== Header =====
  // Logo block
  drawLogoMark(ctx, padding, padding + 6, 44);
  ctx.fillStyle = '#E5E7EB';
  ctx.font = '800 22px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('FinanceAi', padding + 56, padding + 14);
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillText('relatório personalizado', padding + 56, padding + 38);

  // Title (centered-ish, second line)
  ctx.fillStyle = '#F5E8CC';
  ctx.font = "italic 700 28px 'Instrument Serif', Georgia, serif";
  ctx.fillText(title, padding, padding + 70);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${items.length} ${items.length === 1 ? 'transação' : 'transações'} · ${new Date().toLocaleDateString('pt-BR')}`,
    padding,
    padding + 102,
  );

  // ===== Rows =====
  let y = padding + headerH;

  for (const t of items) {
    const isExpense = t.valor < 0;

    // Card background
    roundRect(ctx, padding, y, width - padding * 2, rowH - 8, 14);
    ctx.fillStyle = '#1A1333';
    ctx.fill();

    // Left color accent strip
    ctx.fillStyle = isExpense ? '#EC4899' : '#84CC16';
    roundRect(ctx, padding, y, 4, rowH - 8, 14);
    ctx.fill();

    // Date pill
    ctx.fillStyle = '#241844';
    roundRect(ctx, padding + 18, y + 12, 70, rowH - 32, 8);
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fmtDate(t.data), padding + 18 + 35, y + 12 + (rowH - 32 - 12) / 2);
    ctx.textAlign = 'left';

    // Description
    ctx.fillStyle = '#E5E7EB';
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    const descMax = width - padding * 2 - 240;
    ctx.fillText(ellipsize(ctx, t.descricao, descMax), padding + 100, y + 16);

    // Category
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.fillText(t.categoria, padding + 100, y + 36);

    // Value
    ctx.fillStyle = isExpense ? '#EC4899' : '#84CC16';
    ctx.font = '800 16px Inter, system-ui, sans-serif';
    const valorStr = (isExpense ? '− ' : '+ ') + fmt(Math.abs(t.valor));
    const wM = ctx.measureText(valorStr).width;
    ctx.fillText(valorStr, width - padding - 16 - wM, y + (rowH - 8 - 16) / 2);

    y += rowH;
  }

  // ===== Total card =====
  y += 4;
  const totalIsExpense = total < 0;
  const totalBg = totalIsExpense ? '#F87171' : total === 0 ? '#8B5CF6' : '#84CC16';
  const totalFg = '#0B0B0F';
  roundRect(ctx, padding, y, width - padding * 2, totalRowH - 8, 18);
  ctx.fillStyle = totalBg;
  ctx.fill();

  ctx.fillStyle = totalFg;
  ctx.font = '800 11px Inter, system-ui, sans-serif';
  ctx.fillText('TOTAL', padding + 22, y + 22);
  ctx.font = '900 30px Inter, system-ui, sans-serif';
  const totalStr = (total < 0 ? '− ' : '+ ') + fmt(Math.abs(total));
  const tw = ctx.measureText(totalStr).width;
  ctx.fillText(totalStr, width - padding - 22 - tw, y + 30);

  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${items.length} ${items.length === 1 ? 'item' : 'itens'}`,
    padding + 22,
    y + 44,
  );

  // ===== Footer =====
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '500 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('financeai · gerado pela Luna', padding, height - padding / 2);

  ctx.fillStyle = '#6D28D9';
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('financeai.app', width - padding, height - padding / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ===== Output =====
  const pngUrl = canvas.toDataURL('image/png');

  if (navigator.share && canShareFile()) {
    try {
      const blob = await (await fetch(pngUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      await navigator.share({ files: [file], title });
      return;
    } catch { /* fallback to download */ }
  }

  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = filename;
  a.click();
}

function drawLogoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Rounded square with purple→pink gradient
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#6D28D9');
  grad.addColorStop(1, '#EC4899');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, size, size, size * 0.25);
  ctx.fill();

  // Three ascending bars
  const barW = size * 0.13;
  const cx = x + size * 0.5;
  const baseY = y + size * 0.78;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  drawBar(ctx, cx - size * 0.32, baseY, barW, size * 0.32);
  drawBar(ctx, cx - barW / 2, baseY, barW, size * 0.46);
  drawBar(ctx, cx + size * 0.18, baseY, barW, size * 0.62);

  // Accent dot (acid green)
  ctx.fillStyle = '#84CC16';
  ctx.beginPath();
  ctx.arc(cx + size * 0.18 + barW / 2, baseY - size * 0.62 + 1, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number) {
  roundRect(ctx, x, baseY - h, w, h, w * 0.3);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function canShareFile(): boolean {
  try {
    return !!(navigator as any).canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] });
  } catch { return false; }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, m) + '…').width <= maxWidth) lo = m;
    else hi = m - 1;
  }
  return text.slice(0, lo) + '…';
}

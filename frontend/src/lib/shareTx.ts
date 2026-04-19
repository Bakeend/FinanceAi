/**
 * Gera uma imagem PNG compartilhável de uma ou várias transações.
 * Zero deps: desenha direto no canvas.
 */

type Tx = { data: string; descricao: string; valor: number; categoria: string };

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => s.split('-').reverse().join('/');

export async function renderTransactionsAsImage(
  items: Tx[],
  options: { title?: string; filename?: string } = {},
): Promise<void> {
  const title = options.title ?? 'Resumo — FinanceAi';
  const filename = options.filename ?? 'transacoes.png';
  const padding = 32;
  const rowHeight = 56;
  const headerHeight = 100;
  const totalHeight = 60;
  const width = 720;
  const scale = 2;

  const total = items.reduce((s, i) => s + i.valor, 0);
  const canvas = document.createElement('canvas');
  const height = headerHeight + items.length * rowHeight + totalHeight + padding * 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas sem contexto');
  ctx.scale(scale, scale);

  // bg gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0b0f1a');
  grad.addColorStop(1, '#141a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 26px system-ui, "DM Sans", sans-serif';
  ctx.fillText(title, padding, padding + 30);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, "DM Sans", sans-serif';
  ctx.fillText(`${items.length} ${items.length === 1 ? 'transação' : 'transações'}`, padding, padding + 54);

  // rows
  let y = headerHeight;
  for (const t of items) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(padding, y, width - padding * 2, 1);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px system-ui, "DM Sans", sans-serif';
    ctx.fillText(fmtDate(t.data), padding, y + 24);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui, "DM Sans", sans-serif';
    const descMax = width - padding * 2 - 230;
    const desc = ellipsize(ctx, t.descricao, descMax);
    ctx.fillText(desc, padding + 90, y + 24);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, "DM Sans", sans-serif';
    ctx.fillText(t.categoria, padding + 90, y + 42);

    ctx.fillStyle = t.valor < 0 ? '#f87171' : '#34d399';
    ctx.font = 'bold 14px system-ui, "DM Sans", sans-serif';
    const valorStr = fmt(t.valor);
    const w = ctx.measureText(valorStr).width;
    ctx.fillText(valorStr, width - padding - w, y + 34);

    y += rowHeight;
  }

  // total
  y += 10;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(padding, y, width - padding * 2, 1);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px system-ui, "DM Sans", sans-serif';
  ctx.fillText('Total', padding, y + 28);
  ctx.fillStyle = total < 0 ? '#f87171' : '#34d399';
  ctx.font = 'bold 20px system-ui, "DM Sans", sans-serif';
  const totalStr = fmt(total);
  const tw = ctx.measureText(totalStr).width;
  ctx.fillText(totalStr, width - padding - tw, y + 30);

  // brand footer
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, "DM Sans", sans-serif';
  ctx.fillText('FinanceAi', padding, height - padding / 2);

  // download
  const pngUrl = canvas.toDataURL('image/png');

  // Try Web Share API with file if available
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

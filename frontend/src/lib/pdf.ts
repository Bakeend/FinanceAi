import jsPDF from 'jspdf';
import type { Summary, Transaction } from './types';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Brand palette
const C = {
  ink: [11, 11, 15] as [number, number, number],
  inkSoft: [82, 82, 91] as [number, number, number],
  inkMute: [161, 161, 170] as [number, number, number],
  hairline: [228, 228, 231] as [number, number, number],
  panel: [250, 248, 255] as [number, number, number],
  brand: [109, 40, 217] as [number, number, number],
  brandSoft: [139, 92, 246] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],
  green: [132, 204, 22] as [number, number, number],
  greenInk: [54, 83, 20] as [number, number, number],
  pinkInk: [127, 29, 29] as [number, number, number],
};

export function generateMonthlyReportPdf(args: {
  summary: Summary;
  items: Transaction[];
  mes: number;
  ano: number;
}): Blob {
  const { summary, items, mes, ano } = args;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;

  drawHeaderBar(doc, w);
  drawWordmark(doc, margin, 70);
  drawMonthBadge(doc, w - margin, 70, mes, ano);

  let y = 130;

  // Hero strap
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.5);
  doc.line(margin, y, w - margin, y);
  y += 28;

  // Section title
  setH2(doc);
  doc.text('Resumo do mês', margin, y);
  y += 22;

  // Three solid cards
  const gap = 12;
  const cardW = (w - margin * 2 - gap * 2) / 3;
  const cardH = 92;
  drawSolidCard(doc, margin, y, cardW, cardH, 'ENTRADAS', '+ ' + fmt(Math.abs(summary.totalEntrada)), C.green, C.greenInk);
  drawSolidCard(doc, margin + cardW + gap, y, cardW, cardH, 'GASTOS', '- ' + fmt(Math.abs(summary.totalGasto)), C.pink, C.pinkInk);
  const balPos = summary.saldo >= 0;
  drawSolidCard(
    doc,
    margin + (cardW + gap) * 2,
    y,
    cardW,
    cardH,
    'SALDO',
    fmt(summary.saldo),
    balPos ? C.brandSoft : C.pink,
    balPos ? [49, 27, 92] : C.pinkInk,
  );
  y += cardH + 32;

  // By category
  setH2(doc);
  doc.text('Gastos por categoria', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const totalGasto = Math.abs(summary.totalGasto) || 1;
  const cats = (summary.porCategoria ?? []).filter((c) => Math.abs(c.total) > 0);
  if (cats.length === 0) {
    doc.setTextColor(...C.inkMute);
    doc.text('Nenhum gasto neste mês.', margin, y + 4);
    y += 22;
  } else {
    for (const c of cats) {
      if (y > h - 100) {
        doc.addPage();
        drawHeaderBar(doc, w);
        y = margin;
      }
      const pct = (Math.abs(c.total) / totalGasto) * 100;
      doc.setTextColor(...C.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(c.categoria, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.inkSoft);
      doc.text(fmt(c.total), w - margin - 70, y, { align: 'right' });
      doc.setTextColor(...C.brand);
      doc.setFont('helvetica', 'bold');
      doc.text(`${pct.toFixed(1)}%`, w - margin, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      // Bar
      doc.setFillColor(...C.hairline);
      doc.roundedRect(margin, y + 5, w - margin * 2, 4, 2, 2, 'F');
      doc.setFillColor(...C.brandSoft);
      doc.roundedRect(margin, y + 5, ((w - margin * 2) * pct) / 100, 4, 2, 2, 'F');
      y += 22;
    }
  }

  y += 14;

  // Transactions table
  if (y > h - 160) { doc.addPage(); drawHeaderBar(doc, w); y = margin; }
  setH2(doc);
  doc.text('Transações', margin, y);
  y += 18;

  // Table header
  doc.setFillColor(...C.panel);
  doc.roundedRect(margin, y - 12, w - margin * 2, 24, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.inkSoft);
  doc.text('DATA', margin + 12, y + 3);
  doc.text('DESCRIÇÃO', margin + 80, y + 3);
  doc.text('CATEGORIA', w - margin - 200, y + 3);
  doc.text('VALOR', w - margin - 12, y + 3, { align: 'right' });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const sortedItems = [...items]
    .filter((t) => !t.isTransfer)
    .sort((a, b) => a.data.localeCompare(b.data));

  let zebra = false;
  for (const t of sortedItems) {
    if (y > h - 60) {
      doc.addPage();
      drawHeaderBar(doc, w);
      y = margin;
    }
    if (zebra) {
      doc.setFillColor(252, 252, 254);
      doc.rect(margin, y - 11, w - margin * 2, 18, 'F');
    }
    zebra = !zebra;

    doc.setTextColor(...C.inkSoft);
    doc.setFontSize(9.5);
    doc.text(t.data.split('-').reverse().join('/'), margin + 12, y);
    doc.setTextColor(...C.ink);
    const desc = t.descricao.length > 48 ? t.descricao.slice(0, 45) + '…' : t.descricao;
    doc.text(desc, margin + 80, y);
    doc.setTextColor(...C.inkMute);
    doc.text(t.categoria, w - margin - 200, y);
    if (t.valor < 0) doc.setTextColor(...C.pink);
    else doc.setTextColor(...C.greenInk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text((t.valor < 0 ? '- ' : '+ ') + fmt(Math.abs(t.valor)), w - margin - 12, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 18;
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, w, h, mes, ano, i, total);
  }

  return doc.output('blob');
}

function drawHeaderBar(doc: jsPDF, w: number) {
  // Solid brand strip with subtle pink edge for warmth
  const stripeH = 6;
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, w, stripeH, 'F');
  doc.setFillColor(...C.pink);
  doc.rect(w * 0.6, 0, w * 0.4, stripeH, 'F');
}

function drawWordmark(doc: jsPDF, x: number, y: number) {
  // Logo block (gradient simulated with two rects) + bars
  doc.setFillColor(...C.brand);
  doc.roundedRect(x, y - 22, 28, 28, 6, 6, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 6, y - 8, 3, 8, 1, 1, 'F');
  doc.roundedRect(x + 11, y - 13, 3, 13, 1, 1, 'F');
  doc.roundedRect(x + 16, y - 18, 3, 18, 1, 1, 'F');
  doc.setFillColor(...C.green);
  doc.circle(x + 17.5, y - 18, 1.6, 'F');
  // Wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.ink);
  doc.text('FinanceAi', x + 38, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.inkMute);
  doc.text('Relatório mensal', x + 38, y + 14);
}

function drawMonthBadge(doc: jsPDF, x: number, y: number, mes: number, ano: number) {
  const label = `${MESES[mes - 1].toUpperCase()} ${ano}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const tw = doc.getTextWidth(label) + 18;
  doc.setFillColor(...C.brand);
  doc.roundedRect(x - tw, y - 18, tw, 22, 11, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(label, x - 9, y - 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.inkMute);
  doc.text(`Gerado ${new Date().toLocaleDateString('pt-BR')}`, x, y + 14, { align: 'right' });
}

function drawSolidCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  bg: [number, number, number],
  fg: [number, number, number],
) {
  doc.setFillColor(...bg);
  doc.roundedRect(x, y, w, h, 12, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...fg);
  doc.text(label, x + 14, y + 22);
  doc.setFontSize(20);
  doc.text(value, x + 14, y + h - 18);
}

function setH2(doc: jsPDF) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.ink);
}

function drawFooter(doc: jsPDF, w: number, h: number, mes: number, ano: number, page: number, total: number) {
  doc.setDrawColor(...C.hairline);
  doc.setLineWidth(0.5);
  doc.line(48, h - 36, w - 48, h - 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.inkMute);
  doc.text('FinanceAi', 48, h - 22);
  doc.text(`${MESES[mes - 1]} ${ano}`, w / 2, h - 22, { align: 'center' });
  doc.text(`Página ${page} de ${total}`, w - 48, h - 22, { align: 'right' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

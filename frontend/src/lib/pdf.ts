import jsPDF from 'jspdf';
import type { Summary, Transaction } from './types';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function generateMonthlyReportPdf(args: {
  summary: Summary;
  items: Transaction[];
  mes: number;
  ano: number;
}): Blob {
  const { summary, items, mes, ano } = args;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 60;

  // Header
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 0, w, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('FinanceAi', 40, y);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Relatório mensal', 40, y + 18);

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MESES[mes - 1]} / ${ano}`, w - 40, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, w - 40, y + 18, { align: 'right' });

  y += 50;

  // Totals row
  const card = (label: string, value: string, x: number, color: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, 160, 60, 8, 8, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), x + 12, y + 18);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(value, x + 12, y + 42);
    doc.setFont('helvetica', 'normal');
  };
  card('Entradas', fmt(summary.totalEntrada), 40, [16, 185, 129]);
  card('Gastos', fmt(summary.totalGasto), 210, [244, 63, 94]);
  card('Saldo', fmt(summary.saldo), 380, summary.saldo >= 0 ? [14, 165, 233] : [244, 63, 94]);
  y += 85;

  // By category
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Gastos por categoria', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor(226, 232, 240);
  const totalGasto = Math.abs(summary.totalGasto) || 1;
  for (const c of summary.porCategoria) {
    const pct = (Math.abs(c.total) / totalGasto) * 100;
    doc.setTextColor(15, 23, 42);
    doc.text(c.categoria, 40, y);
    doc.setTextColor(100, 116, 139);
    doc.text(fmt(c.total), w - 120, y, { align: 'left' });
    doc.text(`${pct.toFixed(1)}%`, w - 40, y, { align: 'right' });
    // Bar
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(40, y + 4, w - 80, 3, 1.5, 1.5, 'F');
    doc.setFillColor(56, 189, 248);
    doc.roundedRect(40, y + 4, ((w - 80) * pct) / 100, 3, 1.5, 1.5, 'F');
    y += 16;
    if (y > 780) { doc.addPage(); y = 60; }
  }

  y += 16;

  // Transactions
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Transações', 40, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Data', 40, y);
  doc.text('Descrição', 100, y);
  doc.text('Categoria', w - 180, y);
  doc.text('Valor', w - 40, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(40, y, w - 40, y);
  y += 10;
  doc.setTextColor(15, 23, 42);
  const sortedItems = [...items].sort((a, b) => a.data.localeCompare(b.data));
  for (const t of sortedItems) {
    if (t.isTransfer) continue;
    if (y > 790) { doc.addPage(); y = 60; }
    doc.setTextColor(100, 116, 139);
    doc.text(t.data.split('-').reverse().join('/'), 40, y);
    doc.setTextColor(15, 23, 42);
    const desc = t.descricao.length > 50 ? t.descricao.slice(0, 47) + '…' : t.descricao;
    doc.text(desc, 100, y);
    doc.setTextColor(100, 116, 139);
    doc.text(t.categoria, w - 180, y);
    if (t.valor < 0) doc.setTextColor(244, 63, 94);
    else doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(t.valor), w - 40, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 14;
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`FinanceAi · ${MESES[mes - 1]}/${ano} · Página ${i}/${total}`, w / 2, 820, { align: 'center' });
  }

  return doc.output('blob');
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

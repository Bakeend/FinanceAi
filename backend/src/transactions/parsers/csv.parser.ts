import { parse as parseCsv } from 'papaparse';
import { RawTransaction } from './types';

type Row = Record<string, string>;

export class CsvParser {
  parse(buffer: Buffer): RawTransaction[] {
    const text = buffer.toString('utf8');
    const sep = this.detectSep(text);
    const { data, errors } = parseCsv<Row>(text, { header: true, skipEmptyLines: true, delimiter: sep });
    if (errors.length && !data.length) throw new Error(`CSV parse error: ${errors[0].message}`);
    if (!data.length) throw new Error('CSV vazio');

    const cols = Object.keys(data[0]).map((c) => c.toLowerCase().trim());
    const fmt = this.detectFormat(cols);

    return data.map((row) => this.normalizeRow(row, fmt));
  }

  private detectSep(text: string): string {
    const first = text.split('\n')[0];
    if (first.includes(';')) return ';';
    return ',';
  }

  private detectFormat(cols: string[]): 'nubank' | 'inter' | 'generic' {
    if (cols.includes('date') && cols.includes('title') && cols.includes('amount')) return 'nubank';
    if (cols.some((c) => c.includes('histórico') || c.includes('historico')) || cols.some((c) => c.includes('descrição') || c.includes('descricao') && cols.includes('tipo'))) return 'inter';
    return 'generic';
  }

  private normalizeRow(row: Row, fmt: 'nubank' | 'inter' | 'generic'): RawTransaction {
    const get = (key: string) => {
      const k = Object.keys(row).find((c) => c.toLowerCase().trim() === key.toLowerCase().trim());
      return k ? row[k] : '';
    };

    if (fmt === 'nubank') {
      return {
        data: this.normalizeDate(get('date')),
        descricao: get('title').trim(),
        valor: this.normalizeValor(get('amount')),
      };
    }

    if (fmt === 'inter') {
      const datKey = Object.keys(row).find((c) => c.toLowerCase().includes('data')) ?? '';
      const descKey = Object.keys(row).find((c) => c.toLowerCase().includes('descri') || c.toLowerCase().includes('histor')) ?? '';
      const valKey = Object.keys(row).find((c) => c.toLowerCase().includes('valor')) ?? '';
      const tipoKey = Object.keys(row).find((c) => c.toLowerCase().includes('tipo')) ?? '';
      const raw = row[valKey] ?? '';
      let valor = this.normalizeValor(raw);
      if (tipoKey) {
        const tipo = (row[tipoKey] ?? '').toLowerCase();
        if (tipo.includes('déb') || tipo.includes('deb') || tipo.includes('saída') || tipo.includes('saida')) valor = -Math.abs(valor);
        else if (tipo.includes('cré') || tipo.includes('cre') || tipo.includes('entrada')) valor = Math.abs(valor);
      }
      return {
        data: this.normalizeDate(row[datKey] ?? ''),
        descricao: (row[descKey] ?? '').trim(),
        valor,
      };
    }

    // generic — original logic
    const required = ['data', 'descricao', 'valor'];
    for (const col of required) {
      if (!Object.keys(row).some((c) => c.toLowerCase().trim() === col)) throw new Error(`Coluna obrigatória ausente: ${col}`);
    }
    const datKey = Object.keys(row).find((c) => c.toLowerCase().trim() === 'data') ?? 'data';
    const descKey = Object.keys(row).find((c) => c.toLowerCase().trim() === 'descricao') ?? 'descricao';
    const valKey = Object.keys(row).find((c) => c.toLowerCase().trim() === 'valor') ?? 'valor';
    return { data: this.normalizeDate(row[datKey]), descricao: row[descKey].trim(), valor: this.normalizeValor(row[valKey]) };
  }

  private normalizeDate(s: string): string {
    if (!s) throw new Error('Data vazia');
    const clean = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const m = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const m2 = clean.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    throw new Error(`Data inválida: ${s}`);
  }

  private normalizeValor(s: string): number {
    const cleaned = (s ?? '').trim().replace(/\s/g, '');
    const isBr = /,\d{1,2}$/.test(cleaned);
    const normalized = isBr ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const n = Number(normalized);
    if (Number.isNaN(n)) throw new Error(`Valor inválido: ${s}`);
    return n;
  }
}

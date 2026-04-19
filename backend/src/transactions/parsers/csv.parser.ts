import { parse as parseCsv } from 'papaparse';
import { RawTransaction } from './types';

export class CsvParser {
  parse(buffer: Buffer): RawTransaction[] {
    const text = buffer.toString('utf8');
    const sep = text.includes(';') && !text.includes(',') ? ';' : (text.split('\n')[0].includes(';') ? ';' : ',');
    const { data, errors } = parseCsv<Record<string, string>>(text, {
      header: true, skipEmptyLines: true, delimiter: sep,
    });
    if (errors.length) throw new Error(`CSV parse error: ${errors[0].message}`);
    if (!data.length) throw new Error('CSV vazio');
    const required = ['data', 'descricao', 'valor'];
    for (const col of required) {
      if (!(col in data[0])) throw new Error(`Coluna obrigatória ausente: ${col}`);
    }
    return data.map((row) => ({
      data: this.normalizeDate(row.data),
      descricao: row.descricao.trim(),
      valor: this.normalizeValor(row.valor),
    }));
  }

  private normalizeDate(s: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    throw new Error(`Data inválida: ${s}`);
  }

  private normalizeValor(s: string): number {
    const cleaned = s.trim().replace(/\s/g, '');
    const isBr = /,\d{1,2}$/.test(cleaned);
    const normalized = isBr ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
    const n = Number(normalized);
    if (Number.isNaN(n)) throw new Error(`Valor inválido: ${s}`);
    return n;
  }
}

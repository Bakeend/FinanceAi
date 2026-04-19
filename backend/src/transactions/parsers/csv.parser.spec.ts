import { readFileSync } from 'fs';
import { join } from 'path';
import { CsvParser } from './csv.parser';

describe('CsvParser', () => {
  const parser = new CsvParser();
  const load = (name: string) => readFileSync(join(__dirname, '../../../test/fixtures', name));

  it('parses ISO date + dot-decimal CSV', () => {
    const result = parser.parse(load('extrato.csv'));
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Supermercado XYZ', valor: -150.45 });
    expect(result[1].valor).toBe(3500);
  });

  it('parses BR date + comma-decimal CSV with semicolon separator', () => {
    const result = parser.parse(load('extrato-br.csv'));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Padaria', valor: -12.5 });
    expect(result[1]).toEqual({ data: '2026-04-02', descricao: 'Aluguel', valor: -1200 });
  });

  it('throws on missing required column', () => {
    const bad = Buffer.from('data,descricao\n2026-04-01,foo');
    expect(() => parser.parse(bad)).toThrow(/coluna.*valor/i);
  });
});

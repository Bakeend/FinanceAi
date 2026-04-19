import { readFileSync } from 'fs';
import { join } from 'path';
import { PdfParser } from './pdf.parser';

describe('PdfParser', () => {
  const txt = (name: string) => readFileSync(join(__dirname, '../../../test/fixtures', name), 'utf8');

  it('parses heuristically when text matches dd/mm/yyyy pattern', async () => {
    const parser = new PdfParser({ extractText: async () => txt('extrato-limpo.txt'), fallbackAi: jest.fn() });
    const result = await parser.parse(Buffer.from('fake'));
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ data: '2026-04-01', descricao: 'Supermercado ABC', valor: -150.45 });
    expect(result[1].valor).toBe(3500);
  });

  it('falls back to AI when heuristic finds <3 lines', async () => {
    const aiResult = [{ data: '2026-04-01', descricao: 'X', valor: -10 }];
    const fallback = jest.fn().mockResolvedValue(aiResult);
    const parser = new PdfParser({ extractText: async () => 'lixo sem datas', fallbackAi: fallback });
    const result = await parser.parse(Buffer.from('fake'));
    expect(fallback).toHaveBeenCalledWith('lixo sem datas');
    expect(result).toEqual(aiResult);
  });

  it('throws when extracted text is empty (scanned PDF)', async () => {
    const parser = new PdfParser({ extractText: async () => '   ', fallbackAi: jest.fn() });
    await expect(parser.parse(Buffer.from('fake'))).rejects.toThrow(/imagem/i);
  });
});

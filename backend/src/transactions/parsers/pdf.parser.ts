import { RawTransaction } from './types';

export type PdfParserDeps = {
  extractText?: (buf: Buffer) => Promise<string>;
  fallbackAi: (rawText: string) => Promise<RawTransaction[]>;
};

const HEURISTIC_RE = /^\s*(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d\.]+,\d{2})\s*$/gm;
const MIN_LINES = 3;

export class PdfParser {
  constructor(private readonly deps: PdfParserDeps) {}

  async parse(buffer: Buffer): Promise<RawTransaction[]> {
    const extract =
      this.deps.extractText ??
      (async (b: Buffer) => {
        // pdf-parse v2: class-based API, not a default function.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(b) });
        try {
          const result = await parser.getText();
          return result.text ?? '';
        } finally {
          await parser.destroy?.();
        }
      });
    const text = await extract(buffer);
    if (!text || !text.trim()) {
      throw new Error('PDF parece ser imagem; use CSV ou PDF com texto nativo.');
    }

    const matches = [...text.matchAll(HEURISTIC_RE)];
    if (matches.length >= MIN_LINES) {
      return matches.map((m) => ({
        data: this.toIso(m[1]),
        descricao: m[2].trim(),
        valor: this.toNumber(m[3]),
      }));
    }
    return this.deps.fallbackAi(text);
  }

  private toIso(s: string): string {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }

  private toNumber(s: string): number {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
}

import { RawTransaction } from './types';

/**
 * Parser de OFX (Open Financial Exchange) — padrão de extratos dos bancos BR.
 * Aceita OFX 1.x (SGML) e OFX 2.x (XML). Foca em STMTTRN blocks.
 */
export class OfxParser {
  parse(buffer: Buffer): RawTransaction[] {
    const text = buffer.toString('utf8').replace(/\r\n?/g, '\n');
    // Extract the OFX body after headers (both SGML and XML start with <OFX>)
    const ofxStart = text.indexOf('<OFX>');
    const body = ofxStart >= 0 ? text.slice(ofxStart) : text;

    const txs: RawTransaction[] = [];
    // Match <STMTTRN>...</STMTTRN> (both SGML and XML work because we look for closing tag; SGML may omit it but most BR exports include it)
    const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const matches = body.match(blockRe);
    if (!matches) {
      // Fallback: SGML sem tags de fecho — quebrar por <STMTTRN>
      const parts = body.split(/<STMTTRN>/gi).slice(1);
      for (const p of parts) {
        const end = p.search(/<(STMTTRN|\/BANKTRANLIST|\/CCSTMTTRNRS|\/STMTTRNRS)/i);
        const block = end >= 0 ? p.slice(0, end) : p;
        const tx = this.parseBlock(block);
        if (tx) txs.push(tx);
      }
    } else {
      for (const m of matches) {
        const tx = this.parseBlock(m);
        if (tx) txs.push(tx);
      }
    }

    if (!txs.length) throw new Error('Nenhuma transação encontrada no OFX');
    return txs;
  }

  private parseBlock(block: string): RawTransaction | null {
    const date = this.field(block, 'DTPOSTED');
    const amount = this.field(block, 'TRNAMT');
    const memo = this.field(block, 'MEMO') ?? this.field(block, 'NAME') ?? '';
    if (!date || amount == null) return null;
    const data = this.normalizeDate(date);
    const valor = Number(amount.replace(',', '.'));
    if (!data || Number.isNaN(valor)) return null;
    return { data, descricao: memo.trim() || 'Sem descrição', valor };
  }

  private field(block: string, tag: string): string | null {
    // XML style: <TAG>value</TAG>
    const xml = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
    if (xml) return xml[1].trim();
    // SGML style: <TAG>value (until next < or newline)
    const sgml = new RegExp(`<${tag}>([^<\\n\\r]*)`, 'i').exec(block);
    return sgml ? sgml[1].trim() : null;
  }

  private normalizeDate(s: string): string | null {
    // OFX format: YYYYMMDD[HHMMSS[.XXX][TZ]]
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
}

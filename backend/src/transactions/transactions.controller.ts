import { BadRequestException, Body, Controller, Delete, Get, Header, Logger, NotFoundException, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsService } from './transactions.service';
import { CsvParser } from './parsers/csv.parser';
import { PdfParser } from './parsers/pdf.parser';
import { OfxParser } from './parsers/ofx.parser';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ConfirmTransactionsDto } from './dto/confirm-transactions.dto';
import { RecategorizeDto } from './dto/recategorize.dto';
import { AiService } from '../ai/ai.service';
import { AiAuthError, AiUnavailableError } from '../ai/errors';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(
    private readonly txs: TransactionsService,
    private readonly csv: CsvParser,
    private readonly pdf: PdfParser,
    private readonly ofx: OfxParser,
    private readonly ai: AiService,
  ) {}

  private detectKind(file: Express.Multer.File): 'csv' | 'pdf' | 'ofx' {
    const n = file.originalname.toLowerCase();
    if (n.endsWith('.ofx') || n.endsWith('.qfx') || file.mimetype.includes('ofx')) return 'ofx';
    if (file.mimetype.includes('csv') || n.endsWith('.csv')) return 'csv';
    if (file.mimetype === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    throw new BadRequestException('Apenas .csv, .pdf ou .ofx');
  }

  private async parseFile(file: Express.Multer.File) {
    const kind = this.detectKind(file);
    if (kind === 'csv') return this.csv.parse(file.buffer);
    if (kind === 'ofx') return this.ofx.parse(file.buffer);
    return this.pdf.parse(file.buffer);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@CurrentUser() u: U, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    const raw = await this.parseFile(file);

    let cats: { index: number; categoria: string }[] = [];
    let aiWarning: string | null = null;
    try {
      cats = await this.ai.categorizeBatch(raw);
    } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — transações salvas como "Outros".';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — transações salvas como "Outros".';
      else aiWarning = 'Categorização indisponível — transações salvas como "Outros".';
      this.logger.warn(`IA falhou no upload: ${(e as Error).message}`);
    }
    const enriched = raw.map((r, i) => ({
      ...r,
      categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros',
    }));
    const { saved, skipped } = await this.txs.createMany(enriched, u.id);
    return { count: saved.length, skipped, transactions: saved, aiWarning };
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    const raw = await this.parseFile(file);

    let cats: { index: number; categoria: string }[] = [];
    let aiWarning: string | null = null;
    try {
      cats = await this.ai.categorizeBatch(raw);
    } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — categorize manualmente antes de confirmar.';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — sugeridas como "Outros".';
      else aiWarning = 'Categorização indisponível — sugeridas como "Outros".';
    }
    const items = raw.map((r, i) => ({
      ...r,
      categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros',
    }));
    return { items, aiWarning };
  }

  @Post('confirm')
  async confirm(@CurrentUser() u: U, @Body() body: ConfirmTransactionsDto) {
    const { saved, skipped } = await this.txs.createMany(body.items, u.id);
    return { count: saved.length, skipped, transactions: saved };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financeai-export.csv"')
  async export(@CurrentUser() u: U, @Res() res: Response) {
    const all = await this.txs.findAll(u.id);
    const header = 'data,descricao,valor,categoria,tags,created_at\n';
    const escape = (s: string) => {
      const str = String(s ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const body = all.map((t) =>
      [t.data, escape(t.descricao), t.valor.toFixed(2), t.categoria, escape((t.tags ?? []).join('|')), t.createdAt?.toISOString?.() ?? '']
        .join(',')
    ).join('\n');
    res.send(header + body + '\n');
  }

  @Get('export-xls')
  @Header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="financeai-export.xls"')
  async exportXls(@CurrentUser() u: U, @Res() res: Response) {
    const all = await this.txs.findAll(u.id);
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = all.map((t) =>
      `<tr><td>${t.data}</td><td>${esc(t.descricao)}</td><td>${t.valor.toFixed(2)}</td><td>${esc(t.categoria)}</td><td>${esc(t.subcategoria ?? '')}</td><td>${esc((t.tags ?? []).join('|'))}</td></tr>`
    ).join('');
    const byCategoria: Record<string, number> = {};
    for (const t of all) if (t.valor < 0) byCategoria[t.categoria] = (byCategoria[t.categoria] ?? 0) + (-t.valor);
    const catRows = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.toFixed(2)}</td></tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Transacoes</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Categorias</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml></head>
<body>
<table border="1"><caption>Transacoes</caption><tr><th>Data</th><th>Descricao</th><th>Valor</th><th>Categoria</th><th>Subcategoria</th><th>Tags</th></tr>${rows}</table>
<br/>
<table border="1"><caption>Categorias</caption><tr><th>Categoria</th><th>Total gasto</th></tr>${catRows}</table>
</body></html>`;
    res.send(html);
  }

  @Post('recategorize')
  async recategorize(@CurrentUser() u: U, @Body() body: RecategorizeDto = {}) {
    const all = body.mes && body.ano
      ? await this.txs.findByMonth(body.mes, body.ano, u.id)
      : await this.txs.findAll(u.id, 2000);
    if (!all.length) return { updated: 0, total: 0 };

    const CHUNK = 50;
    let updated = 0;
    for (let offset = 0; offset < all.length; offset += CHUNK) {
      const slice = all.slice(offset, offset + CHUNK);
      let cats: { index: number; categoria: string }[] = [];
      try {
        cats = await this.ai.categorizeBatch(
          slice.map((t) => ({ data: t.data, descricao: t.descricao, valor: t.valor })),
        );
      } catch (e) {
        this.logger.warn(`Recategorização falhou no bloco ${offset}: ${(e as Error).message}`);
        continue;
      }
      for (let i = 0; i < slice.length; i++) {
        const cat = cats.find((c) => c.index === i)?.categoria;
        if (cat && cat !== slice[i].categoria) {
          await this.txs.updateOne(slice[i].id, { categoria: cat }, u.id);
          updated++;
        }
      }
    }
    return { updated, total: all.length };
  }

  @Post()
  async createOne(@CurrentUser() u: U, @Body() dto: CreateTransactionDto) {
    if (dto.installments && dto.installments > 1) {
      const created = await this.txs.createInstallments({
        data: dto.data,
        descricao: dto.descricao,
        valorTotal: dto.valor,
        parcelas: dto.installments,
        categoria: dto.categoria,
        accountId: dto.accountId,
      }, u.id);
      return { saved: created[0] ?? null, skipped: 0, installments: created.length };
    }
    const { saved, skipped } = await this.txs.createManual(dto, u.id);
    return { saved: saved[0] ?? null, skipped };
  }

  @Post('transfer')
  async transfer(@CurrentUser() u: U, @Body() body: { data: string; valor: number; fromAccountId: string; toAccountId: string; descricao?: string }) {
    if (!body?.data || !body?.fromAccountId || !body?.toAccountId || typeof body?.valor !== 'number') {
      throw new BadRequestException('Campos obrigatórios: data, valor, fromAccountId, toAccountId');
    }
    try {
      const saved = await this.txs.createTransfer(body, u.id);
      return { saved };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('ocr-receipt')
  async ocrReceipt(@Body() body: { imageDataUrl: string }) {
    if (!body?.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) {
      throw new BadRequestException('imageDataUrl deve ser data URL de imagem');
    }
    try {
      return await this.ai.ocrReceipt(body.imageDataUrl);
    } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      this.logger.warn(`OCR falhou: ${(e as Error).message}`);
      throw new BadRequestException('Não foi possível ler o recibo.');
    }
  }

  @Post('ocr-screenshot')
  async ocrScreenshot(@Body() body: { imageDataUrl: string }) {
    if (!body?.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) {
      throw new BadRequestException('imageDataUrl deve ser data URL de imagem');
    }
    try {
      const items = await this.ai.ocrMultiReceipt(body.imageDataUrl);
      let cats: { index: number; categoria: string }[] = [];
      if (items.length) {
        try { cats = await this.ai.categorizeBatch(items); } catch { /* fallback */ }
      }
      return { items: items.map((it, i) => ({ ...it, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' })) };
    } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      throw new BadRequestException('Não foi possível ler o screenshot.');
    }
  }

  @Post('paste-text')
  async pasteText(@Body() body: { text: string }) {
    if (!body?.text || body.text.trim().length < 10) {
      throw new BadRequestException('Cole o texto de um e-mail ou NF-e (pelo menos 10 caracteres).');
    }
    try {
      const raw = await this.ai.extractTransactions(body.text);
      let cats: { index: number; categoria: string }[] = [];
      if (raw.length) {
        try { cats = await this.ai.categorizeBatch(raw); } catch { /* fallback */ }
      }
      return { items: raw.map((it, i) => ({ ...it, categoria: cats.find((c) => c.index === i)?.categoria ?? 'Outros' })) };
    } catch (e) {
      if (e instanceof AiAuthError || e instanceof AiUnavailableError) throw e;
      throw new BadRequestException('Não foi possível extrair transações desse texto.');
    }
  }

  @Post('upload-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo file)');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Arquivo precisa ser uma imagem.');
    }
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    let aiWarning: string | null = null;
    let extracted: Awaited<ReturnType<AiService['ocrReceipt']>> = {
      data: null, descricao: file.originalname || 'Comprovante', valor: null, categoria: 'Outros',
    };
    try {
      extracted = await this.ai.ocrReceipt(dataUrl);
    } catch (e) {
      if (e instanceof AiAuthError) aiWarning = 'API key inválida — preencha manualmente.';
      else if (e instanceof AiUnavailableError) aiWarning = 'Limite da IA atingido — preencha manualmente.';
      else aiWarning = 'Não foi possível ler — preencha manualmente.';
      this.logger.warn(`OCR upload falhou: ${(e as Error).message}`);
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      item: {
        data: extracted.data ?? today,
        descricao: extracted.estabelecimento
          ? `${extracted.estabelecimento} — ${extracted.descricao}`.slice(0, 100)
          : extracted.descricao,
        valor: extracted.valor ?? 0,
        categoria: extracted.categoria,
        attachment: dataUrl,
      },
      aiWarning,
    };
  }

  @Post(':id/split')
  async split(@CurrentUser() u: U, @Param('id') id: string, @Body() body: { items: { valor: number; categoria: string; descricao?: string }[] }) {
    const saved = await this.txs.splitTransaction(id, body?.items ?? [], u.id);
    if (!saved) throw new NotFoundException('Transação não encontrada');
    return { items: saved };
  }

  @Get()
  list(
    @CurrentUser() u: U,
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
    @Query('categoria') categoria?: string,
    @Query('q') q?: string,
    @Query('tipo') tipo?: 'entrada' | 'gasto' | 'all',
    @Query('accountId') accountId?: string,
  ) {
    return this.txs.findFiltered(u.id, {
      mes: mes ? Number(mes) : undefined,
      ano: ano ? Number(ano) : undefined,
      categoria,
      q,
      tipo,
      accountId,
    });
  }

  @Patch(':id')
  async update(@CurrentUser() u: U, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    const { applyToInstallments, ...patch } = dto;
    const updated = await this.txs.updateOne(id, patch as any, u.id, { applyToInstallments });
    if (!updated) throw new NotFoundException('Transação não encontrada');
    return updated;
  }

  @Delete(':id')
  async delete(@CurrentUser() u: U, @Param('id') id: string) {
    await this.txs.remove(id, u.id);
    return { ok: true };
  }

  @Patch('bulk/update')
  bulkUpdate(@CurrentUser() u: U, @Body() body: { ids: string[]; categoria?: string; tags?: string[]; isTransfer?: boolean }) {
    const { ids, ...patch } = body ?? { ids: [] };
    return this.txs.bulkUpdate(ids ?? [], patch, u.id);
  }

  @Post('bulk/delete')
  bulkDelete(@CurrentUser() u: U, @Body() body: { ids: string[] }) {
    return this.txs.bulkRemove(body?.ids ?? [], u.id);
  }

  @Post('process-recurring')
  async processRecurring(@CurrentUser() u: U) {
    const created = await this.txs.processRecurring(u.id);
    return { created };
  }

  @Get(':id/tag-suggestions')
  suggestTags(@CurrentUser() u: U, @Param('id') id: string) {
    return this.txs.suggestTags(id, u.id).then((tags) => ({ tags }));
  }

  @Get(':id/history')
  async history(@CurrentUser() u: U, @Param('id') id: string) {
    const edits = await this.txs.listEdits(id, u.id);
    return { edits };
  }
}

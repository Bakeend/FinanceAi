import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { ChatMessageEntity } from './chat-message.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { AnalyzeDto } from './dto/analyze.dto';
import { ChatDto } from './dto/chat.dto';
import { CurrentUser } from '../auth/auth.module';

type U = { id: string; username: string };

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly txs: TransactionsService,
    @InjectRepository(ChatMessageEntity) private readonly msgRepo: Repository<ChatMessageEntity>,
  ) {}

  @Get('memory')
  async getMemory(@CurrentUser() u: U) {
    const content = await this.ai.getMemory(u.id);
    return { content };
  }

  @Post('memory')
  async setMemory(@CurrentUser() u: U, @Body() body: { content: string }) {
    const content = await this.ai.setMemory(body?.content ?? '', u.id);
    return { content };
  }

  @Post('parse-tx')
  async parseTx(@Body() body: { text: string }) {
    if (!body?.text || typeof body.text !== 'string') {
      return { error: 'Campo text obrigatório' };
    }
    const today = new Date().toISOString().slice(0, 10);
    const parsed = await this.ai.parseNaturalTransaction(body.text, today);
    return parsed;
  }

  @Post('search')
  async search(@CurrentUser() u: U, @Body() body: { text: string }) {
    if (!body?.text || typeof body.text !== 'string') {
      return { error: 'Campo text obrigatório' };
    }
    const today = new Date().toISOString().slice(0, 10);
    const filters = await this.ai.translateSearchQuery(body.text, today);
    const items = await this.txs.findFiltered(u.id, {
      mes: filters.mes,
      ano: filters.ano,
      categoria: filters.categoria,
      q: filters.q,
      tipo: filters.tipo,
    });
    let final = items;
    if (filters.from) final = final.filter((t) => t.data >= filters.from!);
    if (filters.to) final = final.filter((t) => t.data <= filters.to!);
    const total = final.reduce((s, t) => s + t.valor, 0);
    const count = final.length;
    return { filters, items: final.slice(0, 100), total, count };
  }

  @Post('analyze')
  async analyze(@CurrentUser() u: U, @Body() dto: AnalyzeDto) {
    const rows = await this.txs.findByMonth(dto.mes, dto.ano, u.id);
    const priorMes = dto.mes === 1 ? 12 : dto.mes - 1;
    const priorAno = dto.mes === 1 ? dto.ano - 1 : dto.ano;
    const priorRows = await this.txs.findByMonth(priorMes, priorAno, u.id);
    const priorMonth = priorRows.length
      ? {
          mes: priorMes,
          ano: priorAno,
          totalGasto: priorRows.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0),
          totalEntrada: priorRows.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0),
        }
      : undefined;
    const texto = await this.ai.analyze(rows, dto.mes, dto.ano, priorMonth);
    return { texto };
  }

  @Post('forecast')
  async forecast(@CurrentUser() u: U, @Body() dto: AnalyzeDto) {
    const series: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = dto.mes - i <= 0 ? dto.mes - i + 12 : dto.mes - i;
      const y = dto.mes - i <= 0 ? dto.ano - 1 : dto.ano;
      const rows = await this.txs.findByMonth(m, y, u.id);
      const total = rows.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
      series[`${y}-${String(m).padStart(2, '0')}`] = total;
    }
    return this.ai.forecast(series);
  }

  @Post('chat')
  async chat(@CurrentUser() u: U, @Body() dto: ChatDto) {
    const now = new Date();
    const mes = dto.mes ?? now.getMonth() + 1;
    const ano = dto.ano ?? now.getFullYear();
    const rows = await this.txs.findByMonth(mes, ano, u.id);
    const expenses = rows.filter((r) => r.valor < 0);
    const income = rows.filter((r) => r.valor > 0);
    const totalGasto = expenses.reduce((s, r) => s + r.valor, 0);
    const totalEntrada = income.reduce((s, r) => s + r.valor, 0);
    const porCategoria: Record<string, number> = {};
    for (const r of expenses) porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + r.valor;
    const top = [...expenses].sort((a, b) => a.valor - b.valor).slice(0, 5);
    const contexto = [
      `Mês analisado: ${String(mes).padStart(2, '0')}/${ano}`,
      `Total de gastos: R$ ${Math.abs(totalGasto).toFixed(2)} em ${expenses.length} transações.`,
      `Total de entradas: R$ ${totalEntrada.toFixed(2)} em ${income.length} transações.`,
      `Saldo: R$ ${(totalEntrada + totalGasto).toFixed(2)}.`,
      '',
      'Gastos por categoria:',
      Object.entries(porCategoria).sort((a, b) => a[1] - b[1]).map(([k, v]) => `- ${k}: R$ ${Math.abs(v).toFixed(2)}`).join('\n'),
      '',
      'Top 5 maiores gastos deste mês:',
      top.map((t) => `- ${t.data} · R$ ${Math.abs(t.valor).toFixed(2)} · [${t.categoria}] ${t.descricao.slice(0, 80)}`).join('\n'),
    ].join('\n');
    const resposta = await this.ai.chat(dto.mensagem, dto.historico, contexto);
    await this.msgRepo.save([
      this.msgRepo.create({ role: 'user', content: dto.mensagem, userId: u.id }),
      this.msgRepo.create({ role: 'assistant', content: resposta, userId: u.id }),
    ]);
    return { resposta };
  }

  @Get('chat/history')
  async history(@CurrentUser() u: U) {
    const msgs = await this.msgRepo.find({ where: { userId: u.id }, order: { createdAt: 'ASC' }, take: 200 });
    return msgs.map((m) => ({ role: m.role, content: m.content }));
  }

  @Delete('chat/history')
  async clearHistory(@CurrentUser() u: U) {
    await this.msgRepo.delete({ userId: u.id });
    return { ok: true };
  }
}

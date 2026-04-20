import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenRouterClient, ChatMessage } from './openrouter.client';
import { RawTransaction } from '../transactions/parsers/types';
import { CATEGORIAS, CATEGORIA_HINTS } from '../transactions/categoria.enum';
import { AiMemoryEntity } from './memory.entity';
import { MEMORY_CORE, buildSystemPrompt } from './memory';

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class AiService {
  constructor(
    private readonly client: OpenRouterClient,
    @InjectRepository(AiMemoryEntity) private readonly memoryRepo: Repository<AiMemoryEntity>,
  ) {}

  async getMemory(userId?: string): Promise<string> {
    if (!userId) return '';
    const row = await this.memoryRepo.findOne({ where: { userId } });
    return row?.content ?? '';
  }

  async setMemory(content: string, userId: string): Promise<string> {
    const clean = (content ?? '').trim().slice(0, 4000);
    await this.memoryRepo.upsert({ userId, content: clean }, ['userId']);
    return clean;
  }

  private async buildSys(taskRules: string, extraContext?: string, userId?: string): Promise<string> {
    const userMemory = await this.getMemory(userId);
    return buildSystemPrompt({ userMemory, taskRules, extraContext });
  }

  async categorizeBatch(rows: RawTransaction[]): Promise<{ index: number; categoria: string }[]> {
    const list = rows.map((r, i) => `${i}: ${r.descricao} (${r.valor})`).join('\n');
    const hints = CATEGORIAS.map((c) => `- ${c}: ${CATEGORIA_HINTS[c] ?? ''}`).join('\n');
    const taskRules = [
      '## TAREFA: categorizar transações financeiras brasileiras',
      '',
      'REGRAS ESPECÍFICAS:',
      '1) SEMPRE prefira uma categoria específica ao invés de "Outros". Use "Outros" APENAS se absolutamente nenhuma outra fizer sentido.',
      '2) Transações com valor POSITIVO (entrada) → prefira "Salário" (se recorrente/holerite), "Renda extra" (freelance, vendas, pix de cliente) ou "Transferência".',
      '3) Transações com valor NEGATIVO (gasto) → use a categoria do tipo de despesa.',
      '4) Reconheça marcas brasileiras comuns: iFood, Rappi, Zé Delivery → Alimentação; Uber, 99, Latam, Gol → Transporte/Viagem; Nubank, Itaú, Bradesco → identifique pelo contexto.',
      '5) "Pix enviado/recebido" sem contexto específico → "Transferência". Com nome que remete a empresa/loja → categorize pelo que é.',
      '6) Assinaturas digitais (Netflix, Spotify, HBO, Disney+, YouTube Premium) → "Assinaturas", NÃO "Lazer".',
      '7) Supermercado/atacadão/hortifruti → "Mercado" (separado de "Alimentação" que é restaurante/delivery).',
      '8) Energia, água, gás, internet, celular → "Contas" (separado de "Moradia" que é aluguel/condomínio).',
      '',
      'Categorias disponíveis (com exemplos):',
      hints,
      '',
      'SAÍDA: APENAS um JSON array [{"index":N,"categoria":"X"}]. Sem texto extra, sem markdown.',
    ].join('\n');

    const sys = await this.buildSys(taskRules);
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: list },
    ];
    return this.tryParseJson(messages, rows.length);
  }

  async translateSearchQuery(text: string, today: string): Promise<{
    mes?: number; ano?: number;
    categoria?: string;
    q?: string;
    tipo?: 'entrada' | 'gasto' | 'all';
    from?: string; to?: string;
    resumo?: string;
  }> {
    const taskRules = [
      '## TAREFA: converter pergunta em PT-BR em filtros de busca estruturados',
      '',
      `Hoje é ${today}.`,
      `Categorias: ${CATEGORIAS.join(', ')}.`,
      'Responda APENAS JSON {"mes":N|null,"ano":N|null,"categoria":"X"|null,"q":"texto"|null,"tipo":"entrada"|"gasto"|"all"|null,"from":"YYYY-MM-DD"|null,"to":"YYYY-MM-DD"|null,"resumo":"frase descritiva em PT-BR"}.',
      'Use mes/ano para mês específico, OU from/to para range explícito. "q" é busca em descrição. Omita campos não usados (null).',
      'Exemplos:',
      '- "quanto gastei em restaurantes em março 2026" → {"mes":3,"ano":2026,"q":"restaurante","tipo":"gasto","resumo":"Gastos com \\"restaurante\\" em março/2026"}',
      '- "minhas entradas do ano" → {"ano":<ano_atual>,"tipo":"entrada","resumo":"Entradas do ano"}',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const res = await this.client.chat([
      { role: 'system', content: sys },
      { role: 'user', content: text },
    ], { jsonMode: true });
    try {
      const p = JSON.parse(this.stripFences(res.content));
      const allowed = new Set<string>(CATEGORIAS as readonly string[]);
      return {
        mes: typeof p.mes === 'number' && p.mes >= 1 && p.mes <= 12 ? p.mes : undefined,
        ano: typeof p.ano === 'number' && p.ano > 1900 ? p.ano : undefined,
        categoria: p.categoria && allowed.has(p.categoria) ? p.categoria : undefined,
        q: typeof p.q === 'string' && p.q.trim() ? p.q.trim() : undefined,
        tipo: ['entrada', 'gasto', 'all'].includes(p.tipo) ? p.tipo : undefined,
        from: typeof p.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.from) ? p.from : undefined,
        to: typeof p.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.to) ? p.to : undefined,
        resumo: typeof p.resumo === 'string' ? this.stripMarkdown(p.resumo) : undefined,
      };
    } catch {
      return { q: text };
    }
  }

  async parseNaturalTransaction(text: string, today: string): Promise<RawTransaction & { categoria: string; conta?: string }> {
    const taskRules = [
      '## TAREFA: converter frase em transação estruturada',
      '',
      `Data de referência (hoje): ${today}. Converta referências relativas ("hoje", "ontem", "dia 5") em datas ISO YYYY-MM-DD.`,
      `Categorias permitidas: ${CATEGORIAS.join(', ')}.`,
      'Se o texto mencionar um banco/conta/cartão (ex: "no Nubank", "no Itaú", "no cartão Inter"), inclua o campo "conta" com o nome exato. Caso contrário, omita "conta".',
      'Responda APENAS JSON {"data":"YYYY-MM-DD","descricao":"...","valor":N,"categoria":"X","conta":"NomeDaConta"}. Valor negativo = gasto, positivo = entrada. Sem markdown.',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: text },
    ];
    const res = await this.client.chat(messages, { jsonMode: true });
    try {
      const parsed = JSON.parse(this.stripFences(res.content));
      const allowed = new Set<string>(CATEGORIAS as readonly string[]);
      if (!parsed.data || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data)) parsed.data = today;
      if (typeof parsed.valor !== 'number' || !Number.isFinite(parsed.valor)) throw new Error('valor invalido');
      if (!parsed.descricao) parsed.descricao = text.slice(0, 80);
      if (!allowed.has(parsed.categoria)) parsed.categoria = 'Outros';
      const conta = typeof parsed.conta === 'string' && parsed.conta.trim() ? parsed.conta.trim().slice(0, 50) : undefined;
      return { data: parsed.data, descricao: String(parsed.descricao).slice(0, 200), valor: Number(parsed.valor), categoria: parsed.categoria, conta };
    } catch {
      throw new Error('Não consegui extrair a transação dessa frase.');
    }
  }

  async ocrMultiReceipt(imageDataUrl: string): Promise<RawTransaction[]> {
    const today = new Date().toISOString().slice(0, 10);
    const hints = CATEGORIAS.join(', ');
    const taskRules = [
      '## TAREFA: extrair MÚLTIPLAS transações de um screenshot (ex: tela de extrato bancário, lista de pedidos)',
      '',
      `Hoje é ${today}. Use null se a data não aparecer.`,
      'VALOR negativo para gastos, positivo para entradas.',
      `Categorias válidas: ${hints}.`,
      'Responda APENAS JSON array [{"data":"YYYY-MM-DD","descricao":"...","valor":N,"categoria":"X"}]. Sem texto extra.',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const res = await this.client.chat(
      [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia todas as transações visíveis.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      { jsonMode: true },
    );
    try {
      const arr = JSON.parse(this.stripFences(res.content));
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((p) => p.data && /^\d{4}-\d{2}-\d{2}$/.test(p.data) && p.descricao && typeof p.valor === 'number')
        .map((p) => ({ data: p.data, descricao: String(p.descricao).slice(0, 200), valor: p.valor }));
    } catch {
      return [];
    }
  }

  async ocrReceipt(imageDataUrl: string): Promise<{ data: string | null; descricao: string; valor: number | null; categoria: string; estabelecimento?: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const hints = CATEGORIAS.join(', ');
    const taskRules = [
      '## TAREFA: extrair dados de um recibo/nota fiscal a partir de uma foto',
      '',
      `Hoje é ${today}. Se a data no recibo não estiver clara, use null.`,
      'Sempre retorne VALOR negativo (é um gasto).',
      `Escolha uma categoria entre: ${hints}. Use "Outros" só se nada servir.`,
      'Responda APENAS JSON: {"data":"YYYY-MM-DD"|null,"descricao":"texto curto do estabelecimento + item principal","valor":N|null,"categoria":"X","estabelecimento":"nome"}.',
      'Sem markdown, sem texto extra.',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const res = await this.client.chat(
      [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia os dados principais deste recibo.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      { jsonMode: true },
    );
    try {
      const p = JSON.parse(this.stripFences(res.content));
      const allowed = new Set<string>(CATEGORIAS as readonly string[]);
      const valorNum = typeof p.valor === 'number' ? (p.valor > 0 ? -p.valor : p.valor) : null;
      return {
        data: typeof p.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null,
        descricao: typeof p.descricao === 'string' && p.descricao.trim() ? this.stripMarkdown(p.descricao).slice(0, 100) : 'Recibo',
        valor: valorNum,
        categoria: typeof p.categoria === 'string' && allowed.has(p.categoria) ? p.categoria : 'Outros',
        estabelecimento: typeof p.estabelecimento === 'string' ? this.stripMarkdown(p.estabelecimento).slice(0, 60) : undefined,
      };
    } catch {
      return { data: null, descricao: 'Recibo', valor: null, categoria: 'Outros' };
    }
  }

  async extractTransactions(rawText: string): Promise<RawTransaction[]> {
    const taskRules = [
      '## TAREFA: extrair transações de texto cru de extrato bancário',
      '',
      'Responda APENAS um JSON array [{"data":"YYYY-MM-DD","descricao":"...","valor":N}]. Negativo = gasto. Sem texto extra.',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: rawText.slice(0, 8000) },
    ];
    const res = await this.client.chat(messages, { jsonMode: true });
    try {
      const parsed = JSON.parse(this.stripFences(res.content));
      if (!Array.isArray(parsed)) throw new Error('not array');
      return parsed.filter((p) => p.data && p.descricao && typeof p.valor === 'number');
    } catch {
      return [];
    }
  }

  async analyze(
    transactions: { categoria: string; valor: number; descricao: string; data: string }[],
    mes: number,
    ano: number,
    priorMonth?: { mes: number; ano: number; totalGasto: number; totalEntrada: number },
  ): Promise<string> {
    if (transactions.length === 0) {
      return `Nenhuma transação registrada em ${String(mes).padStart(2, '0')}/${ano}. Faça um upload para começar.`;
    }

    const expenses = transactions.filter((t) => t.valor < 0);
    const income = transactions.filter((t) => t.valor > 0);
    const totalGasto = expenses.reduce((s, t) => s + t.valor, 0);
    const totalEntrada = income.reduce((s, t) => s + t.valor, 0);
    const saldo = totalEntrada + totalGasto;

    const topExpenses = [...expenses]
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 10)
      .map((t) => `  - ${t.data} · R$ ${Math.abs(t.valor).toFixed(2).padStart(10, ' ')} · [${t.categoria}] ${t.descricao.slice(0, 80)}`)
      .join('\n');

    const byCat = this.summarize(expenses);

    const priorBlock = priorMonth
      ? `\n\nMês anterior (${String(priorMonth.mes).padStart(2, '0')}/${priorMonth.ano}): gasto R$ ${Math.abs(priorMonth.totalGasto).toFixed(2)}, entrada R$ ${priorMonth.totalEntrada.toFixed(2)}.`
      : '';

    const taskRules = [
      '## TAREFA: consultor financeiro pessoal',
      '',
      'REGRAS ESPECÍFICAS:',
      '1) Cite valores em R$ com duas casas decimais e nomes/descrições reais das transações que aparecem nos dados.',
      '2) Compare com o mês anterior SE fornecido, dizendo se aumentou ou diminuiu e em quanto.',
      '3) Aponte a MAIOR transação individual e comente sobre ela especificamente.',
      '4) Aponte a categoria que mais pesou em R$ e o percentual sobre o total de gastos.',
      '5) Se a categoria dominante for "Outros", sugira explicitamente que o usuário clique em "Recategorizar" no dashboard.',
      '6) Máximo 5 dicas, cada uma específica à situação real do usuário — NADA de conselhos genéricos tipo "faça uma lista de compras".',
      '7) Use listas numeradas (1., 2., 3.).',
    ].join('\n');
    const sys = await this.buildSys(taskRules);

    const user = [
      `Mês analisado: ${String(mes).padStart(2, '0')}/${ano}`,
      `Total de gastos: R$ ${Math.abs(totalGasto).toFixed(2)} (${expenses.length} transações)`,
      `Total de entradas: R$ ${totalEntrada.toFixed(2)} (${income.length} transações)`,
      `Saldo: R$ ${saldo.toFixed(2)}${priorBlock}`,
      '',
      'Top 10 maiores gastos individuais:',
      topExpenses,
      '',
      'Totais por categoria:',
      byCat || '  (sem gastos)',
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ];
    const res = await this.client.chat(messages);
    return this.stripMarkdown(res.content);
  }

  async forecast(transactionsByMonth: Record<string, number>): Promise<{ texto: string; valorEstimado: number | null }> {
    const entries = Object.entries(transactionsByMonth);
    const nonZero = entries.filter(([, v]) => v !== 0);
    if (nonZero.length < 2) {
      return {
        texto: 'Histórico insuficiente para previsão — preciso de pelo menos 2 meses com movimentação. Faça mais uploads.',
        valorEstimado: null,
      };
    }
    const series = entries.map(([k, v]) => `${k}: R$ ${Math.abs(v).toFixed(2)} em gastos`).join('\n');
    const avg = nonZero.reduce((s, [, v]) => s + v, 0) / nonZero.length;
    const taskRules = [
      '## TAREFA: prever gastos do próximo mês',
      '',
      'Baseie-se nos dados reais; cite a tendência observada (subindo/caindo/estável) e o valor médio dos meses informados.',
      'Responda APENAS em JSON {"texto":"...","valorEstimado":N}. N deve ser negativo (representa gasto). Sem markdown, sem texto extra.',
      'No campo "texto", em até 3 frases: (1) cite a tendência, (2) cite o valor médio mensal observado, (3) explique a estimativa.',
    ].join('\n');
    const sys = await this.buildSys(taskRules);
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: `Histórico de gasto mensal:\n${series}\n\nMédia dos meses com movimentação: R$ ${Math.abs(avg).toFixed(2)}.\n\nEstime o próximo mês.` },
    ];
    const res = await this.client.chat(messages, { jsonMode: true });
    try {
      const parsed = JSON.parse(this.stripFences(res.content));
      const rawValor = parsed.valorEstimado;
      const valorEstimado =
        typeof rawValor === 'number' && Number.isFinite(rawValor) && Math.abs(rawValor) < 1e9
          ? rawValor
          : null;
      return {
        texto: this.stripMarkdown(String(parsed.texto ?? '')),
        valorEstimado,
      };
    } catch {
      return { texto: this.stripMarkdown(res.content), valorEstimado: null };
    }
  }

  async chat(mensagem: string, historico: ChatHistoryItem[], contexto: string): Promise<string> {
    const taskRules = [
      '## TAREFA: assistente financeiro pessoal (modo conversa)',
      '',
      'Quando perguntarem sobre gastos, cite valores em R$ com duas casas decimais, datas e descrições das transações que aparecem nos DADOS DO MÊS abaixo.',
      'Se a pergunta não puder ser respondida com os dados fornecidos, diga isso honestamente.',
    ].join('\n');
    const extraContext = `## DADOS DO MÊS ATUAL DO USUÁRIO\n${contexto}`;
    const sys = await this.buildSys(taskRules, extraContext);
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      ...historico,
      { role: 'user', content: mensagem },
    ];
    const res = await this.client.chat(messages);
    return this.stripMarkdown(res.content);
  }

  private async tryParseJson(messages: ChatMessage[], expectedLen: number) {
    const allowed = new Set<string>(CATEGORIAS as readonly string[]);
    const fallback = Array.from({ length: expectedLen }, (_, i) => ({ index: i, categoria: 'Outros' }));
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.chat(messages, { jsonMode: true });
      try {
        const parsed = JSON.parse(this.stripFences(res.content));
        if (!Array.isArray(parsed)) throw new Error('not array');
        return parsed.map((p, i) => ({
          index: typeof p.index === 'number' ? p.index : i,
          categoria: allowed.has(p.categoria) ? p.categoria : 'Outros',
        }));
      } catch {
        messages = [
          ...messages,
          { role: 'system', content: 'Sua última resposta não foi JSON válido. Responda APENAS o JSON array, sem markdown, sem texto extra.' },
        ];
      }
    }
    return fallback;
  }

  private stripFences(s: string): string {
    return s.trim().replace(/^```(?:json)?\n?/i, '').replace(/```$/, '').trim();
  }

  private stripMarkdown(s: string): string {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1$2')
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1$2')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '- ')
      .replace(/`([^`]+)`/g, '$1');
  }

  private summarize(rows: { categoria: string; valor: number }[]): string {
    const totals: Record<string, number> = {};
    for (const r of rows) {
      if (r.valor < 0) totals[r.categoria] = (totals[r.categoria] ?? 0) + r.valor;
    }
    return Object.entries(totals).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join('\n');
  }
}

// Re-export for tests or external use
export { MEMORY_CORE };

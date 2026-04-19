import { AiService } from './ai.service';
import { OpenRouterClient } from './openrouter.client';

const mockMemoryRepo = { findOne: jest.fn().mockResolvedValue({ content: '' }), upsert: jest.fn() } as any;

describe('AiService.categorizeBatch', () => {
  it('parses JSON response into categoria per index', async () => {
    const chat = jest.fn().mockResolvedValue({
      content: '[{"index":0,"categoria":"Alimentação"},{"index":1,"categoria":"Transporte"}]',
      model: 'm',
    });
    const client = { chat } as unknown as OpenRouterClient;
    const svc = new AiService(client, mockMemoryRepo);
    const result = await svc.categorizeBatch([
      { data: '2026-04-01', descricao: 'Padaria', valor: -10 },
      { data: '2026-04-02', descricao: 'Uber', valor: -22 },
    ]);
    expect(result).toEqual([{ index: 0, categoria: 'Alimentação' }, { index: 1, categoria: 'Transporte' }]);
  });

  it('retries once on malformed JSON, then returns Outros for all', async () => {
    const chat = jest.fn()
      .mockResolvedValueOnce({ content: 'lixo', model: 'm' })
      .mockResolvedValueOnce({ content: 'ainda lixo', model: 'm' });
    const svc = new AiService({ chat } as any, mockMemoryRepo);
    const result = await svc.categorizeBatch([
      { data: '2026-04-01', descricao: 'X', valor: -1 },
    ]);
    expect(result).toEqual([{ index: 0, categoria: 'Outros' }]);
    expect(chat).toHaveBeenCalledTimes(2);
  });
});

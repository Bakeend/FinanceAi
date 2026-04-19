import { OpenRouterClient } from './openrouter.client';
import { AiAuthError, AiUnavailableError } from './errors';

const okResponse = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }], model: 'm' }),
});
const errResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({ error: 'x' }),
  text: async () => 'x',
});

describe('OpenRouterClient', () => {
  const baseConfig = {
    apiKey: 'sk-test',
    referer: 'http://localhost',
    title: 'Test',
    models: ['model-a', 'model-b', 'model-c'],
    rateLimit: { capacity: 100, refillPerSec: 100 },
  };

  it('returns content from first successful model', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse('hello'));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    const res = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to next model on 429', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(errResponse(429))
      .mockResolvedValueOnce(okResponse('from b'));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    const res = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('from b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AiAuthError on 401 without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(errResponse(401));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    await expect(
      client.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(AiAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws AiUnavailableError when all models fail with 429', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errResponse(429));
    const client = new OpenRouterClient(baseConfig, fetchMock as any);
    await expect(
      client.chat([{ role: 'user', content: 'hi' }]),
    ).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

import { AiAuthError, AiUnavailableError } from './errors';
import { TokenBucket } from './rate-limiter';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};
export type OpenRouterConfig = {
  apiKey: string;
  referer: string;
  title: string;
  models: string[];
  rateLimit?: { capacity: number; refillPerSec: number };
  timeoutMs?: number;
};
export type ChatResult = { content: string; model: string };

export class OpenRouterClient {
  private bucket: TokenBucket;
  constructor(
    private readonly cfg: OpenRouterConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    const rl = cfg.rateLimit ?? { capacity: 20, refillPerSec: 20 / 60 };
    this.bucket = new TokenBucket(rl.capacity, rl.refillPerSec);
  }

  async chat(
    messages: ChatMessage[],
    opts: { jsonMode?: boolean } = {},
  ): Promise<ChatResult> {
    let lastErr: Error | null = null;
    for (const model of this.cfg.models) {
      await this.bucket.acquire();
      try {
        return await this.callOnce(model, messages, opts.jsonMode ?? false);
      } catch (e) {
        if (e instanceof AiAuthError) throw e;
        lastErr = e as Error;
      }
    }
    throw lastErr instanceof AiUnavailableError
      ? lastErr
      : new AiUnavailableError();
  }

  private async callOnce(
    model: string,
    messages: ChatMessage[],
    jsonMode: boolean,
  ): Promise<ChatResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 30000);
    try {
      const res = await this.fetchFn(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfg.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.cfg.referer,
            'X-Title': this.cfg.title,
          },
          body: JSON.stringify({
            model,
            messages,
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: ctrl.signal,
        },
      );
      if (res.status === 401) throw new AiAuthError();
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Modelo ${model} indisponível (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Resposta sem content');
      return { content, model: typeof json.model === 'string' ? json.model : model };
    } finally {
      clearTimeout(timer);
    }
  }
}

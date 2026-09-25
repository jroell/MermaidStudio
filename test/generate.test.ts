import type { Redis } from '@upstash/redis';
import { createSpendGuard } from 'spend-guard';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFixHandler,
  MAX_CODE_CHARS,
  MAX_OUTPUT_TOKENS,
  MODEL,
  PRICES,
  type FixGuard,
  type GeminiClient,
} from '../server/fixMermaid';

const BROKEN = {
  code: 'flowchart TD\n    A[Start] --> B{Missing Bracket\n    B --> C[End]',
  errorMessage: "Parse error on line 2: Expecting 'DIAMOND_STOP', got 'NEWLINE'",
};
const FIXED = 'flowchart TD\n    A[Start] --> B{Missing Bracket}\n    B --> C[End]';

function fixRequest(body: unknown): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

function fakeGemini(result: Awaited<ReturnType<GeminiClient['models']['generateContent']>>) {
  const generateContent = vi.fn<GeminiClient['models']['generateContent']>(async () => result);
  return { client: { models: { generateContent } } satisfies GeminiClient, generateContent };
}

function fakeRedis(overrides: Partial<Record<'get' | 'incrbyfloat' | 'expire', (...args: unknown[]) => unknown>> = {}) {
  const redis = {
    get: vi.fn(overrides.get ?? (async () => null)),
    incrbyfloat: vi.fn(overrides.incrbyfloat ?? (async () => 0)),
    expire: vi.fn(overrides.expire ?? (async () => 1)),
  };
  return { redis, asRedis: redis as unknown as Redis };
}

function realGuard(redis: Redis) {
  return createSpendGuard({
    app: 'mermaid-studio',
    redis,
    perVisitor: { requests: 30, window: '1 h' },
    dailyCapUsd: 5,
    totalDailyCapUsd: 20,
    prices: PRICES,
    now: () => new Date('2026-09-25T12:00:00Z'),
  });
}

function allowingGuard(record: FixGuard['record'] = vi.fn<FixGuard['record']>(async () => 0)): FixGuard {
  return { check: vi.fn(async () => ({ ok: true as const })), record };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fix endpoint refusals', () => {
  it('passes the daily_budget refusal through unchanged and never calls Gemini', async () => {
    const { redis, asRedis } = fakeRedis({ get: async () => 100 });
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard: realGuard(asRedis), gemini: gemini.client })(fixRequest(BROKEN));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'daily_budget',
      message: "Today's budget is used up, come back tomorrow.",
    });
    expect(gemini.generateContent).not.toHaveBeenCalled();
    expect(redis.incrbyfloat).not.toHaveBeenCalled();
  });

  it('passes the 503 through when Redis cannot be read and never calls Gemini', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { asRedis } = fakeRedis({
      get: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard: realGuard(asRedis), gemini: gemini.client })(fixRequest(BROKEN));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'budget_unavailable',
      message: 'Spending limits cannot be checked right now. Try again in a minute.',
    });
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('passes a rate_limited refusal through with its Retry-After header', async () => {
    const refusal = new Response(
      JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again in a few minutes.' }),
      { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': '120' } },
    );
    const record = vi.fn<FixGuard['record']>(async () => 0);
    const guard: FixGuard = { check: vi.fn(async () => ({ ok: false as const, response: refusal })), record };
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard, gemini: gemini.client })(fixRequest(BROKEN));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(await response.json()).toEqual({
      error: 'rate_limited',
      message: 'Too many requests. Try again in a few minutes.',
    });
    expect(gemini.generateContent).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a request without code before checking the budget or calling Gemini', async () => {
    const guard = allowingGuard();
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard, gemini: gemini.client })(fixRequest({ errorMessage: 'x' }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_request');
    expect(guard.check).not.toHaveBeenCalled();
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('rejects code longer than the Auto-Fix limit', async () => {
    const guard = allowingGuard();
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard, gemini: gemini.client })(
      fixRequest({ code: 'A'.repeat(MAX_CODE_CHARS + 1), errorMessage: 'x' }),
    );

    expect(response.status).toBe(400);
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });
});

describe('fix endpoint usage recording', () => {
  it('returns the fixed code and records prompt tokens as input and candidate plus thinking tokens as output', async () => {
    const { redis, asRedis } = fakeRedis();
    const guard = realGuard(asRedis);
    const gemini = fakeGemini({
      text: '```mermaid\n' + FIXED + '\n```',
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 150, thoughtsTokenCount: 850 },
    });

    const response = await createFixHandler({
      guard: { check: async () => ({ ok: true }), record: guard.record },
      gemini: gemini.client,
    })(fixRequest(BROKEN));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: FIXED });

    const params = gemini.generateContent.mock.calls[0][0];
    expect(params.model).toBe(MODEL);
    expect(params.config).toEqual({ temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS });
    expect(params.contents).toContain(BROKEN.code);
    expect(params.contents).toContain(BROKEN.errorMessage);

    // 1200 input tokens at $2/M plus 1000 output tokens at $12/M.
    const expectedUsd = 0.0144;
    expect(redis.incrbyfloat).toHaveBeenCalledTimes(2);
    expect(redis.incrbyfloat.mock.calls[0][0]).toBe('spend:mermaid-studio:2026-09-25');
    expect(redis.incrbyfloat.mock.calls[0][1]).toBeCloseTo(expectedUsd, 10);
    expect(redis.incrbyfloat.mock.calls[1][0]).toBe('spend:all:2026-09-25');
    expect(redis.incrbyfloat.mock.calls[1][1]).toBeCloseTo(expectedUsd, 10);
  });

  it('records usage even when Gemini returns no text', async () => {
    const record = vi.fn<FixGuard['record']>(async () => 0);
    const gemini = fakeGemini({
      text: undefined,
      usageMetadata: { promptTokenCount: 900, thoughtsTokenCount: MAX_OUTPUT_TOKENS },
    });

    const response = await createFixHandler({ guard: allowingGuard(record), gemini: gemini.client })(
      fixRequest(BROKEN),
    );

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe('empty_response');
    expect(record).toHaveBeenCalledWith({ model: MODEL, inputTokens: 900, outputTokens: MAX_OUTPUT_TOKENS });
  });

  it('records the worst-case estimate when Gemini omits usage metadata', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = vi.fn<FixGuard['record']>(async () => 0);
    const gemini = fakeGemini({ text: FIXED });

    const response = await createFixHandler({ guard: allowingGuard(record), gemini: gemini.client })(
      fixRequest(BROKEN),
    );

    expect(response.status).toBe(200);
    expect(record).toHaveBeenCalledTimes(1);
    const usage = record.mock.calls[0][0];
    expect(usage.model).toBe(MODEL);
    expect(usage.outputTokens).toBe(MAX_OUTPUT_TOKENS);
    expect(usage.inputTokens).toBeGreaterThan(0);
  });

  it('returns 502 and records nothing when the Gemini call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = vi.fn<FixGuard['record']>(async () => 0);
    const generateContent = vi.fn<GeminiClient['models']['generateContent']>(async () => {
      throw new Error('upstream 500');
    });

    const response = await createFixHandler({
      guard: allowingGuard(record),
      gemini: { models: { generateContent } },
    })(fixRequest(BROKEN));

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe('upstream_failed');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('api/generate configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 503 with a message when the spending caps are not configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'http://127.0.0.1:1');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubEnv('DAILY_CAP_USD', undefined);
    vi.stubEnv('TOTAL_DAILY_CAP_USD', undefined);
    const { POST } = await import('../api/generate');

    const response = await POST(fixRequest(BROKEN));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('not_configured');
    expect(typeof body.message).toBe('string');
  });
});

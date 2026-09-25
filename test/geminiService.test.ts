import { afterEach, describe, expect, it, vi } from 'vitest';

import { AutoFixError, fixMermaidCode } from '../services/geminiService';

function stubFetch(status: number, body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fixMermaidCode', () => {
  it('posts the code and error to the fix endpoint and returns the fixed code', async () => {
    const fetchMock = stubFetch(200, JSON.stringify({ code: 'flowchart TD\n  A --> B' }));

    await expect(fixMermaidCode('flowchart TD\n  A -->', 'Parse error')).resolves.toBe('flowchart TD\n  A --> B');

    expect(fetchMock).toHaveBeenCalledWith('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'flowchart TD\n  A -->', errorMessage: 'Parse error' }),
    });
  });

  it.each([
    [429, 'daily_budget', "Today's budget is used up, come back tomorrow."],
    [429, 'rate_limited', 'Too many requests. Try again in a few minutes.'],
    [503, 'budget_unavailable', 'Spending limits cannot be checked right now. Try again in a minute.'],
  ])('surfaces the server message for a %i %s refusal', async (status, error, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(status, JSON.stringify({ error, message }));

    const failure = await fixMermaidCode('x', 'y').catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(AutoFixError);
    expect((failure as AutoFixError).message).toBe(message);
    expect((failure as AutoFixError).status).toBe(status);
  });

  it('throws a plain error when the server returns no JSON message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(500, '<html>Internal Server Error</html>');

    const failure = await fixMermaidCode('x', 'y').catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(AutoFixError);
    expect((failure as Error).message).toContain('500');
  });
});

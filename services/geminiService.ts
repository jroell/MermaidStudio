const FIX_ENDPOINT = '/api/generate';

/** A failed Auto-Fix request whose message comes from the server and can be shown to the user as is. */
export class AutoFixError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AutoFixError';
  }
}

export const fixMermaidCode = async (brokenCode: string, errorMessage: string): Promise<string> => {
  const response = await fetch(FIX_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: brokenCode, errorMessage }),
  });
  const body: unknown = await response.json().catch(() => null);
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  if (!response.ok) {
    if (typeof fields.message === 'string') {
      throw new AutoFixError(fields.message, response.status);
    }
    throw new Error(`Auto-Fix request failed with status ${response.status}`);
  }
  if (typeof fields.code !== 'string') {
    throw new Error('Auto-Fix response did not include code');
  }
  return fields.code;
};

import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { costUsd, type Prices, type Usage } from 'spend-guard';

// Google retired gemini-3-pro-preview; calls to it now return 404 "no longer available"
// (checked live 2026-09-25). gemini-3.1-pro-preview is the replacement. Its Standard paid tier
// rate for prompts <= 200k tokens is $2.00 input and $12.00 output per 1M tokens, with thinking
// tokens billed as output (https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-pro-preview,
// checked 2026-09-25). The input limits below keep every prompt far under 200k tokens, so the
// higher long-prompt rate never applies.
export const MODEL = 'gemini-3.1-pro-preview';
export const PRICES: Prices = { [MODEL]: { inputPerM: 2, outputPerM: 12 } };

export const MAX_CODE_CHARS = 20_000;
export const MAX_ERROR_CHARS = 2_000;
// Thinking tokens count toward this limit and bill at the output rate.
export const MAX_OUTPUT_TOKENS = 16_384;

// Upper bound for one call: prompt text at the input limits, counted generously at one token
// per 3 characters, plus a full output budget.
const PROMPT_TEMPLATE_CHARS = 1_000;
const WORST_CASE_INPUT_TOKENS = Math.ceil((MAX_CODE_CHARS + MAX_ERROR_CHARS + PROMPT_TEMPLATE_CHARS) / 3);
export const ESTIMATED_MAX_USD = costUsd(PRICES, {
  model: MODEL,
  inputTokens: WORST_CASE_INPUT_TOKENS,
  outputTokens: MAX_OUTPUT_TOKENS,
});

/** The part of the @google/genai client this endpoint uses, so tests can pass a fake. */
export type GeminiClient = {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<Pick<GenerateContentResponse, 'text' | 'usageMetadata'>>;
  };
};

/** The part of a spend-guard instance this endpoint uses. */
export type FixGuard = {
  check(req: Request, o: { estimatedUsd: number }): Promise<{ ok: true } | { ok: false; response: Response }>;
  record(u: Usage): Promise<number>;
};

type FixInput = { code: string; errorMessage: string };

export function buildPrompt({ code, errorMessage }: FixInput): string {
  return `
    You are an expert Mermaid.js diagram developer.
    The user has provided Mermaid code that is failing to render.
    
    Error Message: "${errorMessage}"
    
    Broken Code:
    \`\`\`mermaid
    ${code}
    \`\`\`
    
    Task:
    1. Analyze the syntax error.
    2. Fix the code so it renders correctly while preserving the original intent.
    3. Return ONLY the corrected Mermaid code. Do not wrap it in markdown code blocks (no \`\`\`). Do not add explanations. Just the raw code string.
  `;
}

/** Strips a markdown fence if the model added one despite the instructions. */
export function cleanFixedCode(text: string): string {
  return text.replace(/^```mermaid\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
}

export function createFixHandler({ guard, gemini }: { guard: FixGuard; gemini: GeminiClient }) {
  return async function handleFix(request: Request): Promise<Response> {
    const input = await readInput(request);
    if ('invalid' in input) return errorResponse(400, 'invalid_request', input.invalid);

    const gate = await guard.check(request, { estimatedUsd: ESTIMATED_MAX_USD });
    // The repo's tsconfig is not strict, so `gate.ok` alone does not narrow the union.
    if ('response' in gate) return gate.response;

    let result: Awaited<ReturnType<GeminiClient['models']['generateContent']>>;
    try {
      result = await gemini.models.generateContent({
        model: MODEL,
        contents: buildPrompt(input),
        config: { temperature: 0.1, maxOutputTokens: MAX_OUTPUT_TOKENS },
      });
    } catch (cause) {
      console.error('fix: Gemini request failed', cause);
      return errorResponse(502, 'upstream_failed', 'Auto-Fix could not reach the AI model. Try again in a moment.');
    }

    await recordUsage(guard, result.usageMetadata);

    const text = result.text?.trim();
    if (!text) {
      return errorResponse(502, 'empty_response', 'The AI model returned no code. Try again.');
    }
    return Response.json({ code: cleanFixedCode(text) });
  };
}

async function readInput(request: Request): Promise<FixInput | { invalid: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { invalid: 'Send a JSON body with code and errorMessage strings.' };
  }
  if (typeof body !== 'object' || body === null) {
    return { invalid: 'Send a JSON body with code and errorMessage strings.' };
  }
  const { code, errorMessage } = body as Record<string, unknown>;
  if (typeof code !== 'string' || typeof errorMessage !== 'string') {
    return { invalid: 'Send a JSON body with code and errorMessage strings.' };
  }
  if (!code.trim()) return { invalid: 'There is no diagram code to fix.' };
  if (code.length > MAX_CODE_CHARS) {
    return { invalid: `Auto-Fix handles diagrams up to ${MAX_CODE_CHARS.toLocaleString('en-US')} characters.` };
  }
  return { code, errorMessage: errorMessage.slice(0, MAX_ERROR_CHARS) };
}

async function recordUsage(guard: FixGuard, usage: GenerateContentResponse['usageMetadata']): Promise<void> {
  let tokens: Omit<Usage, 'model'>;
  if (usage?.promptTokenCount === undefined) {
    console.error('fix: Gemini response had no usage metadata, recording the worst-case estimate');
    tokens = { inputTokens: WORST_CASE_INPUT_TOKENS, outputTokens: MAX_OUTPUT_TOKENS };
  } else {
    tokens = {
      inputTokens: usage.promptTokenCount,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    };
  }
  try {
    await guard.record({ model: MODEL, ...tokens });
  } catch (cause) {
    // The call is already paid for, so return the result. Later checks fail closed while Redis is down.
    console.error('fix: could not record spend for a completed Gemini call', { tokens, cause });
  }
}

function errorResponse(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

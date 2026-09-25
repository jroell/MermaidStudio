import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { createSpendGuard } from 'spend-guard';

// Vercel runs this file as a Node ES module, so relative imports need the .js extension.
import { createFixHandler, PRICES } from '../server/fixMermaid.js';

let handleFix: ReturnType<typeof createFixHandler> | undefined;

// Built on first use and reused by warm invocations. A missing setting throws here, so the
// request gets a 503 instead of the module failing to load.
function getFixHandler(): ReturnType<typeof createFixHandler> {
  if (!handleFix) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    handleFix = createFixHandler({
      guard: createSpendGuard({
        app: 'mermaid-studio',
        redis: Redis.fromEnv(),
        perVisitor: { requests: 30, window: '1 h' },
        dailyCapUsd: Number(process.env.DAILY_CAP_USD),
        totalDailyCapUsd: Number(process.env.TOTAL_DAILY_CAP_USD),
        prices: PRICES,
      }),
      gemini: new GoogleGenAI({ apiKey }),
    });
  }
  return handleFix;
}

export async function POST(request: Request): Promise<Response> {
  let fix: ReturnType<typeof createFixHandler>;
  try {
    fix = getFixHandler();
  } catch (cause) {
    console.error('generate: the fix endpoint is not configured', cause);
    return Response.json(
      { error: 'not_configured', message: 'Auto-Fix is not available right now. Try again later.' },
      { status: 503 },
    );
  }
  return fix(request);
}

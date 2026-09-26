## Run Locally

**Prerequisites:** Node.js 22 and the [Vercel CLI](https://vercel.com/docs/cli)

1. Install dependencies:
   `npm install`
2. Link the Vercel project and pull its environment variables:
   `vercel link`, then `vercel env pull .env.local`
3. Run the app and the API together:
   `vercel dev`

`npm run dev` runs only the Vite front end. The editor and preview work, but Auto-Fix needs the `/api/generate` function, which runs under `vercel dev` or on Vercel.

## Tests

`npm test` runs the Vitest suite. It includes a production build with a fake `GEMINI_API_KEY` in the environment, and it fails if that value or the name `GEMINI_API_KEY` appears in any file in `dist/`.

## Deploying

The app deploys to Vercel as a Vite static site plus one Node.js function. `vercel.json` sets:

- Build command: `npm run build`
- Output directory: `dist`
- Function: `api/generate.ts`, with a 120 second maximum duration

The browser never sees the Gemini key. Auto-Fix posts `{ code, errorMessage }` to `/api/generate`, and the function calls Gemini (`gemini-3.1-pro-preview`) with the key held on the server. Every call goes through [spend-guard](https://github.com/jroell/spend-guard). Each visitor IP gets 30 requests per hour, and calls stop for the rest of the UTC day once spend reaches a daily cap.

Set these environment variables in the Vercel project:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key. Server only. Never give it a `VITE_` prefix, because Vite puts `VITE_` variables in the public bundle. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL, used for rate limits and spend counters. The Vercel Upstash integration sets `KV_REST_API_URL` instead, which also works. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. `KV_REST_API_TOKEN` also works. |
| `DAILY_CAP_USD` | Daily Gemini spend limit for this app, in US dollars, for example `2`. |
| `TOTAL_DAILY_CAP_USD` | Daily spend limit shared by every app that uses the same Redis database. |

If the Gemini key or either cap is missing, `/api/generate` returns 503 and Auto-Fix shows "Auto-Fix is not available right now. Try again later." If Redis cannot be reached, the function refuses the call instead of spending without a limit.

Spend is counted from the token counts Gemini returns, at $2.00 per million input tokens and $12.00 per million output tokens. Thinking tokens bill as output. Update `PRICES` in `server/fixMermaid.ts` when Google changes its pricing.

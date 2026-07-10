# SMBThrive

AI receptionist + business intelligence for US food businesses. A restaurant
signs up, uploads its menu, and gets an AI agent that answers its phone and
takes orders, plus an intelligence dashboard about its standing, competitors,
and locality.


## How it works

- **Channel-agnostic brain.** All conversational channels (xAI voice bridge
  first, chat later) call the same tool layer in `src/lib/agent/tools.ts`,
  exposed over `POST /api/agent/tools` (authenticated with an
  `x-agent-secret` header).
- **Grounded ordering.** The agent never free-forms items or prices. Order
  lines resolve against `catalog_items` server-side; prices snapshot onto
  `order_items` at order time.
- **FIFO queue.** Orders land in a queue the owner works through a live
  dashboard (accept / reject / ready), with SMS pings.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind) — owner web app + API routes
- **Supabase** (managed) — Postgres, auth, realtime
- **Twilio ⇄ xAI Grok Voice Agent** — telephony bridge (separate service)
- **Claude** — menu extraction, intel summarization

## Setup

Requires Node 20+ and a managed Supabase project (this repo does not use
`supabase start` / local Docker).

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Same page, Secret keys (`sb_secret_...`) — server-only, bypasses RLS |
| `AGENT_API_SECRET` | Generate yourself: `openssl rand -hex 32` |

Apply the schema to your Supabase project:

```bash
npx -y supabase login
npx -y supabase link --project-ref <your-project-ref>
npx -y supabase db push
```

## Verify

Runs every agent tool end-to-end against the linked project with throwaway
data, then cleans up:

```bash
npx tsx --env-file=.env.local scripts/smoke-tools.ts
# expect: SMOKE PASS: all tool-layer checks green
```

Dev server:

```bash
npm run dev
```

## Layout

```
src/lib/agent/tools.ts        # tool layer: get_menu, check_item, create_order,
                              #   cancel_order, order_status
src/app/api/agent/tools/      # POST endpoint the voice bridge calls
src/lib/supabase/admin.ts     # server-only Supabase client (secret key)
supabase/migrations/          # schema; apply with `npx supabase db push`
scripts/smoke-tools.ts        # end-to-end smoke test
```

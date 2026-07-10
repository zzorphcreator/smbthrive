@AGENTS.md

# SMBThrive

AI receptionist + business intelligence for US food businesses. Full spec —
decisions, flows, data model, build phases, risks — lives in `CONTEXT.md`;
read it before making product or architecture choices.

## Non-negotiable rules

- **Channel-agnostic brain:** all conversational channels (xAI voice bridge
  first, chat later) call the same tool layer in `src/lib/agent/tools.ts`,
  exposed over `POST /api/agent/tools` (header `x-agent-secret`).
- **Grounding:** the agent never free-forms items or prices. Order lines
  resolve against `catalog_items` server-side; prices snapshot onto
  `order_items` at order time.
- **Supabase is managed, not local.** Do not run `supabase start` / local
  Docker. Migrations live in `supabase/migrations/`; apply with
  `npx supabase db push` against the linked project. Local CLI runs via
  `npx -y supabase` (no global install).

## Status (as of 2026-07-08)

Phase 1 (foundation) built: Next.js scaffold, `core_domain` migration
(5 tables, RLS, FIFO index — validated + advisors clean), tool layer
(`get_menu`, `check_item`, `create_order`, `cancel_order`, `order_status`),
smoke script. Typecheck + ESLint pass. **Nothing committed to git yet.**

**Where we left off:** owner is setting up the managed Supabase project
(login → link → db push → fill `.env.local` from `.env.example`).

**Next steps, in order:**
1. Run `npx tsx --env-file=.env.local scripts/smoke-tools.ts` → expect
   `SMOKE PASS` (gates phase 1).
2. First git commit.
3. Phase 2 — owner app: Supabase auth, business registration, catalog
   review UI, live queue dashboard (accept/reject/ready) with realtime,
   SMS pings, and the deferred `escalate_to_owner` tool.

# SMBThrive

AI receptionist + business intelligence for US food businesses.

**One-liner:** A food business signs up, uploads its menu, and gets (a) an AI
receptionist that answers its phone and takes orders, and (b) an intelligence
dashboard about its own standing, competitors, and locality.

## Decisions (2026-07-07 brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Channel | Voice-first via xAI Grok Voice Agent API + Twilio | Speech-to-speech WebSocket API, tool calling, ~$0.05/min; official Twilio phone-agent path exists |
| Market | US / North America | Easy Twilio numbers, phone-ordering culture, English-first |
| Vertical | Food (restaurants, tiffin, bakery) | Cleanest fit for orders + FIFO queue; menu PDF → catalog is natural onboarding |
| Intel | Core to MVP (three fixed panels, weekly refresh) | Owner's explicit call; scope held at three panels |
| Owner side | Web dashboard + SMS ping | Live queue with accept/reject; SMS as attention-getter |

**Architecture rule:** the agent brain is channel-agnostic. All channels
(voice, later chat/WhatsApp) call the same tool layer. The voice provider is
swappable; the tool layer + queue is the product.

**Grounding rule:** the agent never free-forms items or prices. Every order
line resolves against the catalog via tool calls; off-menu requests escalate
to the owner instead of improvising.

## Core flows

### Onboarding
1. Owner registers business (name, address, hours, cuisine).
2. Uploads menu PDF / price list / policy docs.
3. LLM extracts a structured catalog → owner reviews and corrects it
   (human check is mandatory; the catalog is the agent's ground truth).
4. Intel engine runs its first pass.
5. Twilio number provisioned; owner forwards their line. Agent live.

### Order loop
```
Customer calls → Twilio Media Streams ⇄ xAI Voice Agent (WebSocket)
  → agent grounded on catalog, builds order via tools
  → reads full order + total back, gets verbal confirmation
  → create_order() → FIFO queue
  → owner: dashboard update + SMS ping → accept / reject / mark ready
  → customer SMS confirmation with queue position / pickup estimate
```
Cancellation: customer calls back → cancel_order() → owner notified.
Unaccepted orders re-ping the owner after N minutes.

### Intel dashboard (v1 = exactly these three panels)
1. **Your standing** — Google rating trend, LLM-summarized review themes,
   listing completeness.
2. **Competitor map** — same-category businesses within N miles: ratings,
   price level, hours gaps, review themes.
3. **Locality pulse** — nearby openings/closures, local demand signals.
   Weekly refresh.

## Agent tool layer

Channel-agnostic functions exposed to any conversational front end:

- `get_menu(business_id)` — catalog with availability
- `check_item(business_id, query)` — resolve a spoken item name to a catalog item
- `create_order(business_id, customer, items[], notes)` — validates every line against catalog
- `cancel_order(order_id, reason)`
- `order_status(order_id)` — state + queue position
- `escalate_to_owner(business_id, summary)` — off-menu / stuck / upset customer

## Data model (core)

- `businesses` — profile, hours, twilio_number, owner (auth user)
- `catalog_items` — name, description, price_cents, variants (jsonb), available
- `orders` — business_id, customer phone/name, status
  (`pending → accepted → ready → completed`, or `rejected` / `cancelled`),
  placed_at (FIFO key), notes
- `order_items` — order_id, catalog_item_id, qty, unit_price_cents (snapshot),
  variant selection
- `order_events` — append-only audit: created, accepted, cancelled, pinged, …

Prices snapshot onto order lines at order time; catalog edits never mutate
past orders.

## Stack

- Next.js (App Router, TypeScript, Tailwind) — owner web app + API routes
- Supabase — Postgres, auth, realtime (live queue dashboard)
- Node voice bridge service — Twilio Media Streams ⇄ xAI Voice Agent API
- Claude — menu extraction, intel summarization
- Twilio — telephony + SMS

## Build phases

1. **Foundation** *(current)* — repo, spec, Next.js scaffold, Supabase schema,
   tool layer with tests.
2. **Owner app** — auth, business registration, catalog review UI, live queue
   dashboard (accept/reject/ready), SMS notifications.
3. **Menu extraction** — PDF upload → structured catalog draft.
4. **Voice bridge** — Twilio ⇄ xAI agent wired to the tool layer.
   Gate: 20 scripted test calls, zero wrong-price/wrong-item orders.
5. **Intel engine** — Places API + web search → three panels, weekly refresh.

## Risks

1. Voice order accuracy → catalog grounding + mandatory read-back + phase-4 gate.
2. Owner misses orders → acknowledgment state + re-ping escalation.
3. Intel scope creep → v1 frozen at three panels.
4. xAI dependency → channel-agnostic tool layer makes provider swappable.

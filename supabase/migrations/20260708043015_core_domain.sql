-- Core domain: businesses, catalog, orders (FIFO queue), audit events.
-- Customers are not auth users; orders are created server-side (service role).
-- RLS scopes everything to the business owner.

create type order_status as enum
  ('pending', 'accepted', 'ready', 'completed', 'rejected', 'cancelled');

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text,
  cuisine text,
  hours jsonb,
  twilio_number text,
  owner_notify_phone text,
  created_at timestamptz not null default now()
);

create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  variants jsonb not null default '[]',
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_name text,
  customer_phone text not null,
  status order_status not null default 'pending',
  notes text,
  placed_at timestamptz not null default now()
);

-- Line items snapshot name/price at order time; catalog edits never mutate past orders.
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  catalog_item_id uuid not null references catalog_items (id),
  item_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  qty integer not null check (qty > 0),
  variant jsonb
);

-- Append-only audit trail: created, accepted, rejected, ready, completed,
-- cancelled, owner_pinged, escalated.
create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  type text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index businesses_owner_id_idx on businesses (owner_id);
create index catalog_items_business_id_idx on catalog_items (business_id);
-- FIFO queue reads: open orders for a business, oldest first.
create index orders_queue_idx on orders (business_id, status, placed_at);
create index order_items_order_id_idx on order_items (order_id);
create index order_events_order_id_idx on order_events (order_id);

alter table businesses enable row level security;
alter table catalog_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

-- Tables are not auto-exposed to the Data API; grant the owner-facing role
-- explicitly. RLS below restricts rows to the business owner.
grant select, insert, update, delete on businesses, catalog_items, orders to authenticated;
grant select on order_items, order_events to authenticated;

create policy "owners manage their businesses" on businesses
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "owners manage their catalog" on catalog_items
  for all to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));

create policy "owners read their orders" on orders
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));

-- Owners change order status (accept/reject/ready/complete); creation and
-- cancellation come from the agent via service role, which bypasses RLS.
create policy "owners update their orders" on orders
  for update to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));

create policy "owners read their order items" on order_items
  for select to authenticated
  using (order_id in (
    select o.id from orders o
    join businesses b on b.id = o.business_id
    where b.owner_id = (select auth.uid())
  ));

create policy "owners read their order events" on order_events
  for select to authenticated
  using (order_id in (
    select o.id from orders o
    join businesses b on b.id = o.business_id
    where b.owner_id = (select auth.uid())
  ));

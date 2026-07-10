-- Phase 2 (owner app): one business per owner, realtime queue,
-- business-level escalations.

-- One business per owner; onboarding relies on this to be race-proof.
drop index if exists businesses_owner_id_idx;
create unique index businesses_owner_id_key on businesses (owner_id);

-- Live queue dashboard subscribes to order changes. Realtime authorizes
-- each event against the subscriber's RLS select policy on orders.
alter publication supabase_realtime add table orders;

-- Escalations may target a business with no order (off-menu request
-- mid-call). order_events becomes dual-target: order-scoped (default)
-- or business-scoped.
alter table order_events alter column order_id drop not null;
alter table order_events
  add column business_id uuid references businesses (id) on delete cascade;
alter table order_events
  add constraint order_events_has_target
  check (order_id is not null or business_id is not null);
create index order_events_business_id_idx on order_events (business_id)
  where business_id is not null;

create policy "owners read their business events" on order_events
  for select to authenticated
  using (
    business_id in (
      select id from businesses where owner_id = (select auth.uid())
    )
  );

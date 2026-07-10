// End-to-end smoke test for the owner side: auth, RLS isolation, the
// one-business-per-owner constraint, and the dashboard order actions.
// Creates two throwaway owners, exercises the flows, then deletes both.
//
// Run: npx tsx --env-file=.env.local scripts/smoke-owner.ts

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../src/lib/supabase/admin";
import { createOrder, escalateToOwner } from "../src/lib/agent/tools";
import { applyOrderAction } from "../src/lib/orders";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`OWNER SMOKE FAIL: ${message}`);
}

// Headless signed-in client, same publishable key the browser uses.
async function signedInClient(email: string, password: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function main() {
  const admin = createAdminClient();
  const password = `smoke-${Date.now()}-pw`;
  const emailA = `smoke-owner-a-${Date.now()}@example.com`;
  const emailB = `smoke-owner-b-${Date.now()}@example.com`;

  const { data: userA, error: errA } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  const { data: userB, error: errB } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;

  try {
    const a = await signedInClient(emailA, password);
    const b = await signedInClient(emailB, password);

    // Business registration under RLS, and the one-per-owner unique index.
    const { data: business, error: bizError } = await a
      .from("businesses")
      .insert({ owner_id: userA.user.id, name: "Owner Smoke Cafe" })
      .select("id")
      .single();
    if (bizError) throw bizError;
    const { error: dupError } = await a
      .from("businesses")
      .insert({ owner_id: userA.user.id, name: "Second Cafe" });
    assert(dupError?.code === "23505", "second business is rejected (23505)");

    // Catalog CRUD as the owner.
    const { data: item, error: itemError } = await a
      .from("catalog_items")
      .insert({
        business_id: business.id,
        name: "Smoke Idli",
        price_cents: 599,
        available: true,
      })
      .select("id")
      .single();
    if (itemError) throw itemError;
    const { error: updateError } = await a
      .from("catalog_items")
      .update({ price_cents: 649 })
      .eq("id", item.id);
    if (updateError) throw updateError;

    // Agent creates an order; A sees it, B does not.
    const order = await createOrder({
      businessId: business.id,
      customer: { phone: "+15550002222", name: "Owner Smoke" },
      items: [{ catalogItemId: item.id, qty: 1 }],
    });
    const { data: seenByA } = await a
      .from("orders")
      .select("id, order_items (item_name)")
      .eq("id", order.orderId)
      .maybeSingle();
    assert(
      seenByA && seenByA.id === order.orderId,
      "owner sees their order",
    );
    assert(
      seenByA.order_items[0]?.item_name === "Smoke Idli",
      "owner sees order lines",
    );
    const { data: seenByB } = await b
      .from("orders")
      .select("id")
      .eq("id", order.orderId)
      .maybeSingle();
    assert(seenByB === null, "other owners cannot see the order");

    // Owners have no write path to the audit trail.
    const { error: eventInsertError } = await a.from("order_events").insert({
      order_id: order.orderId,
      type: "forged",
    });
    assert(eventInsertError, "direct order_events insert is denied");

    // Dashboard actions: accept -> ready -> complete, with audit events.
    await applyOrderAction(a, order.orderId, "accept");
    await applyOrderAction(a, order.orderId, "ready");
    await applyOrderAction(a, order.orderId, "complete");
    const invalidAction = await applyOrderAction(a, order.orderId, "accept").then(
      () => false,
      () => true,
    );
    assert(invalidAction, "accepting a completed order is rejected");
    const { data: events } = await a
      .from("order_events")
      .select("type")
      .eq("order_id", order.orderId)
      .order("id");
    assert(
      events?.map((e) => e.type).join(",") ===
        "created,owner_pinged,accepted,ready,completed",
      `audit trail — got ${events?.map((e) => e.type).join(",")}`,
    );

    // Business-scoped escalation: visible to A via the business policy only.
    await escalateToOwner({
      businessId: business.id,
      summary: "smoke escalation",
    });
    const { data: escA } = await a
      .from("order_events")
      .select("id")
      .eq("business_id", business.id)
      .eq("type", "escalated");
    assert(escA?.length === 1, "owner reads the business-scoped escalation");
    const { data: escB } = await b
      .from("order_events")
      .select("id")
      .eq("business_id", business.id)
      .eq("type", "escalated");
    assert(escB?.length === 0, "other owners cannot read it");

    console.log("OWNER SMOKE PASS: auth, RLS, and order actions green");
  } finally {
    await admin.auth.admin.deleteUser(userA.user.id);
    await admin.auth.admin.deleteUser(userB.user.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

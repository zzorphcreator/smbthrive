// End-to-end smoke test for the agent tool layer against the managed
// Supabase project. Creates a throwaway owner + business + catalog, runs
// every tool, then deletes the owner (cascades everything).
//
// Run: npx tsx --env-file=.env.local scripts/smoke-tools.ts

import { createAdminClient } from "../src/lib/supabase/admin";
import {
  getMenu,
  checkItem,
  createOrder,
  cancelOrder,
  orderStatus,
} from "../src/lib/agent/tools";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAIL: ${message}`);
}

async function main() {
  const db = createAdminClient();

  const { data: user, error: userError } = await db.auth.admin.createUser({
    email: `smoke-${Date.now()}@example.com`,
    email_confirm: true,
  });
  if (userError) throw userError;
  const ownerId = user.user.id;

  try {
    const { data: business, error: bizError } = await db
      .from("businesses")
      .insert({ owner_id: ownerId, name: "Smoke Test Diner" })
      .select("id")
      .single();
    if (bizError) throw bizError;

    const { data: items, error: itemsError } = await db
      .from("catalog_items")
      .insert([
        // Bulk inserts with mismatched keys send NULL (not the column
        // default) for missing fields, so set `available` on every row.
        {
          business_id: business.id,
          name: "Masala Dosa",
          price_cents: 899,
          available: true,
        },
        {
          business_id: business.id,
          name: "Filter Coffee",
          price_cents: 349,
          available: true,
        },
        {
          business_id: business.id,
          name: "Mysore Pak",
          price_cents: 499,
          available: false,
        },
      ])
      .select("id, name");
    if (itemsError) throw itemsError;
    const dosa = items.find((i) => i.name === "Masala Dosa")!;
    const mysorePak = items.find((i) => i.name === "Mysore Pak")!;

    const menu = await getMenu({ businessId: business.id });
    assert(menu.items.length === 2, "menu shows only available items");

    const match = await checkItem({ businessId: business.id, query: "dosa" });
    assert(match.matches.length === 1, "check_item resolves 'dosa'");
    assert(match.matches[0].id === dosa.id, "check_item returns the right item");

    const unavailable = await createOrder({
      businessId: business.id,
      customer: { phone: "+15550001111" },
      items: [{ catalogItemId: mysorePak.id, qty: 1 }],
    }).then(
      () => false,
      () => true,
    );
    assert(unavailable, "ordering an unavailable item is rejected");

    const order = await createOrder({
      businessId: business.id,
      customer: { phone: "+15550001111", name: "Smoke Tester" },
      items: [{ catalogItemId: dosa.id, qty: 2 }],
      notes: "extra chutney",
    });
    assert(order.totalCents === 1798, `total is 1798, got ${order.totalCents}`);

    const status = await orderStatus({ orderId: order.orderId });
    assert(status.status === "pending", "new order is pending");
    assert(status.queuePosition === 1, "first order is queue position 1");

    const cancelled = await cancelOrder({
      orderId: order.orderId,
      reason: "smoke test",
    });
    assert(cancelled.status === "cancelled", "order cancels");

    const rejectedRecancel = await cancelOrder({ orderId: order.orderId }).then(
      () => false,
      () => true,
    );
    assert(rejectedRecancel, "cancelling twice is rejected");

    const { data: events, error: eventsError } = await db
      .from("order_events")
      .select("type")
      .eq("order_id", order.orderId)
      .order("id");
    if (eventsError) throw eventsError;
    assert(
      events.map((e) => e.type).join(",") === "created,cancelled",
      `audit trail is created,cancelled — got ${events.map((e) => e.type).join(",")}`,
    );

    console.log("SMOKE PASS: all tool-layer checks green");
  } finally {
    await db.auth.admin.deleteUser(ownerId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

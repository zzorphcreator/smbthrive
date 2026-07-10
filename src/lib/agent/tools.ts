import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { pingOwner } from "@/lib/notify";

// Channel-agnostic agent tools. Every conversational front end (xAI voice
// bridge today, chat later) calls these. Grounding rule: order lines only
// ever come from catalog rows — prices are snapshotted server-side, never
// taken from the conversation.

const OPEN_STATUSES = ["pending", "accepted"] as const;

export const getMenuInput = z.object({
  businessId: z.string().uuid(),
});

export async function getMenu(input: z.infer<typeof getMenuInput>) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("catalog_items")
    .select("id, name, description, price_cents, variants")
    .eq("business_id", input.businessId)
    .eq("available", true)
    .order("name");
  if (error) throw new Error(error.message);
  return { items: data };
}

export const checkItemInput = z.object({
  businessId: z.string().uuid(),
  query: z.string().min(1),
});

// Resolve a spoken item name ("do you have paneer 65?") to catalog candidates.
export async function checkItem(input: z.infer<typeof checkItemInput>) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("catalog_items")
    .select("id, name, description, price_cents, variants")
    .eq("business_id", input.businessId)
    .eq("available", true)
    .ilike("name", `%${input.query.replaceAll("%", "")}%`)
    .limit(5);
  if (error) throw new Error(error.message);
  return { matches: data };
}

export const createOrderInput = z.object({
  businessId: z.string().uuid(),
  customer: z.object({
    phone: z.string().min(7),
    name: z.string().optional(),
  }),
  items: z
    .array(
      z.object({
        catalogItemId: z.string().uuid(),
        qty: z.number().int().positive(),
        variant: z.unknown().optional(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});

export async function createOrder(input: z.infer<typeof createOrderInput>) {
  const db = createAdminClient();

  const ids = input.items.map((i) => i.catalogItemId);
  const { data: catalog, error: catalogError } = await db
    .from("catalog_items")
    .select("id, name, price_cents, available")
    .eq("business_id", input.businessId)
    .in("id", ids);
  if (catalogError) throw new Error(catalogError.message);

  const byId = new Map(catalog.map((c) => [c.id, c]));
  for (const line of input.items) {
    const item = byId.get(line.catalogItemId);
    if (!item) throw new Error(`Item ${line.catalogItemId} is not on this menu`);
    if (!item.available) throw new Error(`"${item.name}" is currently unavailable`);
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      business_id: input.businessId,
      customer_phone: input.customer.phone,
      customer_name: input.customer.name ?? null,
      notes: input.notes ?? null,
    })
    .select("id, placed_at")
    .single();
  if (orderError) throw new Error(orderError.message);

  const lines = input.items.map((line) => {
    const item = byId.get(line.catalogItemId)!;
    return {
      order_id: order.id,
      catalog_item_id: item.id,
      item_name: item.name,
      unit_price_cents: item.price_cents,
      qty: line.qty,
      variant: line.variant ?? null,
    };
  });
  const { error: linesError } = await db.from("order_items").insert(lines);
  if (linesError) {
    // No client-side transactions with supabase-js; compensate so we never
    // leave an order without its items.
    await db.from("orders").delete().eq("id", order.id);
    throw new Error(linesError.message);
  }

  await db.from("order_events").insert({
    order_id: order.id,
    type: "created",
    data: { channel: "agent" },
  });

  const totalCents = lines.reduce((sum, l) => sum + l.unit_price_cents * l.qty, 0);
  await pingOwner(db, {
    businessId: input.businessId,
    orderId: order.id,
    message: `New order: ${lines
      .map((l) => `${l.qty}× ${l.item_name}`)
      .join(", ")} — $${(totalCents / 100).toFixed(2)}`,
  });
  return {
    orderId: order.id,
    placedAt: order.placed_at,
    totalCents,
    lines: lines.map((l) => ({
      name: l.item_name,
      qty: l.qty,
      unitPriceCents: l.unit_price_cents,
    })),
  };
}

export const cancelOrderInput = z.object({
  orderId: z.string().uuid(),
  reason: z.string().optional(),
});

export async function cancelOrder(input: z.infer<typeof cancelOrderInput>) {
  const db = createAdminClient();
  // Only open orders can be cancelled by the customer; ready/completed
  // orders need the owner.
  const { data, error } = await db
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", input.orderId)
    .in("status", [...OPEN_STATUSES])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Order not found or already past the point of cancellation");
  }
  await db.from("order_events").insert({
    order_id: input.orderId,
    type: "cancelled",
    data: { reason: input.reason ?? null },
  });
  return { orderId: input.orderId, status: "cancelled" };
}

export const escalateToOwnerInput = z.object({
  businessId: z.string().uuid(),
  summary: z.string().min(1),
  orderId: z.string().uuid().optional(),
});

// Off-menu request, stuck conversation, upset customer: hand off to the
// owner instead of improvising. Order-scoped when an order exists,
// business-scoped otherwise.
export async function escalateToOwner(
  input: z.infer<typeof escalateToOwnerInput>,
) {
  const db = createAdminClient();
  const { data: business, error } = await db
    .from("businesses")
    .select("id")
    .eq("id", input.businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!business) throw new Error("Business not found");

  if (input.orderId) {
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id")
      .eq("id", input.orderId)
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Order not found for this business");
  }

  const { error: eventError } = await db.from("order_events").insert({
    order_id: input.orderId ?? null,
    business_id: input.businessId,
    type: "escalated",
    data: { summary: input.summary },
  });
  if (eventError) throw new Error(eventError.message);

  await pingOwner(db, {
    businessId: input.businessId,
    orderId: input.orderId,
    message: `Escalation: ${input.summary}`,
  });
  return { escalated: true };
}

export const orderStatusInput = z.object({
  orderId: z.string().uuid(),
});

export async function orderStatus(input: z.infer<typeof orderStatusInput>) {
  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id, business_id, status, placed_at")
    .eq("id", input.orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Order not found");

  let queuePosition: number | null = null;
  if ((OPEN_STATUSES as readonly string[]).includes(order.status)) {
    const { count, error: countError } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", order.business_id)
      .in("status", [...OPEN_STATUSES])
      .lte("placed_at", order.placed_at);
    if (countError) throw new Error(countError.message);
    queuePosition = count;
  }
  return { orderId: order.id, status: order.status, queuePosition };
}

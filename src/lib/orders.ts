import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Owner-side order state machine. The status update runs on the caller's
// user-context client so RLS proves ownership; the compare-and-set on
// `status` makes races with the agent (e.g. a customer cancelling mid-click)
// fail cleanly with zero rows instead of clobbering.
export const ORDER_ACTIONS = {
  accept: { from: ["pending"], to: "accepted" },
  reject: { from: ["pending"], to: "rejected" },
  ready: { from: ["accepted"], to: "ready" },
  complete: { from: ["ready"], to: "completed" },
} as const;

export type OrderAction = keyof typeof ORDER_ACTIONS;

export async function applyOrderAction(
  ownerDb: SupabaseClient,
  orderId: string,
  action: OrderAction,
) {
  const { from, to } = ORDER_ACTIONS[action];
  const { data, error } = await ownerDb
    .from("orders")
    .update({ status: to })
    .eq("id", orderId)
    .in("status", [...from])
    .select("id, business_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      `Order not found or not in a state that allows "${action}"`,
    );
  }

  // Owners have no INSERT on order_events; the audit row is written with
  // the admin client only after the RLS-gated update succeeded.
  await createAdminClient().from("order_events").insert({
    order_id: orderId,
    business_id: data.business_id,
    type: to,
    data: { channel: "owner_dashboard" },
  });
  return { orderId, status: to };
}

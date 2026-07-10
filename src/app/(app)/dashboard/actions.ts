"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyOrderAction } from "@/lib/orders";

const orderActionInput = z.object({
  orderId: z.string().uuid(),
  action: z.enum(["accept", "reject", "ready", "complete"]),
});

export async function orderAction(
  orderId: string,
  action: string,
): Promise<{ error?: string }> {
  const parsed = orderActionInput.safeParse({ orderId, action });
  if (!parsed.success) return { error: "Bad request" };

  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) return { error: "Not signed in" };

  try {
    await applyOrderAction(db, parsed.data.orderId, parsed.data.action);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Action failed" };
  }
}

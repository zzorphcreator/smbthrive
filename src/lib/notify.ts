import type { SupabaseClient } from "@supabase/supabase-js";

// SMS ping stub: Phase 4 replaces the console line with Twilio; the
// owner_pinged event row is the durable record either way. Never throws —
// a failed ping must not fail the order that triggered it.
export async function pingOwner(
  db: SupabaseClient,
  input: { businessId: string; orderId?: string; message: string },
) {
  try {
    const { data: business } = await db
      .from("businesses")
      .select("owner_notify_phone")
      .eq("id", input.businessId)
      .maybeSingle();
    console.log(
      "[notify:sms-stub] → %s: %s",
      business?.owner_notify_phone ?? "(no phone on file)",
      input.message,
    );
    await db.from("order_events").insert({
      order_id: input.orderId ?? null,
      business_id: input.businessId,
      type: "owner_pinged",
      data: { message: input.message, channel: "stub" },
    });
  } catch (err) {
    console.error("[notify] ping failed:", err);
  }
}

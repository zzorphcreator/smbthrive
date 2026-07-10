"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string } | null;

export async function registerBusiness(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Business name is required." };

  const { error } = await db.from("businesses").insert({
    owner_id: userId,
    name,
    address: String(formData.get("address") ?? "").trim() || null,
    cuisine: String(formData.get("cuisine") ?? "").trim() || null,
    owner_notify_phone:
      String(formData.get("owner_notify_phone") ?? "").trim() || null,
  });
  // 23505 unique violation: this owner already has a business — done.
  if (error && error.code !== "23505") return { error: error.message };
  redirect("/dashboard");
}

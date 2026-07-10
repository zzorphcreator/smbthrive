import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Request-scoped auth context: verified JWT claims (getClaims checks the
// signature) plus a user-context client. cache() dedupes across layout and
// page within one render.
export const getAuthContext = cache(async () => {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  return { db, userId: data?.claims.sub ?? null };
});

// Guard for pages under the (app) group: the owner's single business must
// exist (RLS scopes the select to auth.uid()).
export const requireBusiness = cache(async () => {
  const { db, userId } = await getAuthContext();
  if (!userId) redirect("/login");
  const { data: business, error } = await db
    .from("businesses")
    .select("id, name")
    .maybeSingle();
  if (error) throw error;
  if (!business) redirect("/onboarding");
  return { db, userId, business };
});

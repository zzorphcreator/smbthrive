import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

// Entry point: route the visitor to wherever they belong. The proxy already
// bounces signed-out visitors to /login before this renders.
export default async function Home() {
  const { db, userId } = await getAuthContext();
  if (!userId) redirect("/login");
  const { data: business } = await db
    .from("businesses")
    .select("id")
    .maybeSingle();
  redirect(business ? "/dashboard" : "/onboarding");
}

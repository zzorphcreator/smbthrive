import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// User-context client for Server Components and Server Actions: RLS
// enforced as the signed-in owner. Create one per request, never share.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't write cookies; the proxy owns
            // session-refresh writes.
          }
        },
      },
    },
  );
}

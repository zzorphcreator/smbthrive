import { createBrowserClient } from "@supabase/ssr";

// Browser client with the publishable key: RLS enforced as the signed-in
// owner. Cookies are handled via document.cookie by default.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

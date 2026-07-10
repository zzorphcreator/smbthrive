import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase session on every matched request and applies
// coarse auth-only redirects. The business-existence check (-> /onboarding)
// needs a DB query and lives in requireBusiness(), not here. Proxy matcher
// exclusions also skip Server Functions, so every server action verifies
// auth itself.
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache headers from @supabase/ssr: responses that set auth
          // cookies must never be cached by a CDN.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const onAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  if (signedIn === onAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = signedIn ? "/dashboard" : "/login";
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/agent).*)"],
};

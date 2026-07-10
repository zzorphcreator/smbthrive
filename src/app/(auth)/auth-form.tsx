"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "./actions";

// Shared login/signup form: email + password, inline error, alternate link.
export function AuthForm({
  title,
  action,
  submitLabel,
  alt,
}: {
  title: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  alt: { prompt: string; href: string; label: string };
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">SMBThrive</h1>
        <p className="mb-6 text-sm text-neutral-500">{title}</p>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete="current-password"
            className="rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "…" : submitLabel}
          </button>
        </form>
        <p className="mt-4 text-sm text-neutral-500">
          {alt.prompt}{" "}
          <Link href={alt.href} className="underline">
            {alt.label}
          </Link>
        </p>
      </div>
    </main>
  );
}

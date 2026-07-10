"use client";

import { useActionState } from "react";
import { registerBusiness } from "./actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(registerBusiness, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Business name *
        <input name="name" required placeholder="Masala Kitchen" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input name="address" placeholder="123 Main St, Austin, TX" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Cuisine
        <input name="cuisine" placeholder="South Indian" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phone for order notifications
        <input
          name="owner_notify_phone"
          type="tel"
          placeholder="+15551234567"
          className={inputClass}
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "…" : "Create business"}
      </button>
    </form>
  );
}

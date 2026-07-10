"use client";

import { useActionState, useRef } from "react";
import { createItem } from "./actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function CreateItemForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createItem>>, formData: FormData) => {
      const result = await createItem(prev, formData);
      if (!result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required placeholder="Masala Dosa" className={inputClass} />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
        Description
        <input name="description" placeholder="Optional" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Price ($)
        <input
          name="price"
          type="number"
          required
          min="0"
          step="0.01"
          placeholder="8.99"
          className={`${inputClass} w-24`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        Add item
      </button>
      {state?.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

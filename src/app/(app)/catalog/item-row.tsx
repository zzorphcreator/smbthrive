"use client";

import { useActionState } from "react";
import { deleteItem, toggleItem, updateItem } from "./actions";

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  variants: unknown[];
  available: boolean;
};

const inputClass =
  "rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function ItemRow({ item }: { item: CatalogItem }) {
  const [editState, editAction, editPending] = useActionState(updateItem, null);
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleItem,
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteItem,
    null,
  );
  const error = editState?.error ?? toggleState?.error ?? deleteState?.error;

  return (
    <li
      className={`rounded border border-neutral-200 p-3 dark:border-neutral-800 ${
        item.available ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-end gap-2">
        <form action={editAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input
            name="name"
            required
            defaultValue={item.name}
            className={inputClass}
          />
          <input
            name="description"
            defaultValue={item.description ?? ""}
            placeholder="Description"
            className={`${inputClass} min-w-48`}
          />
          <input
            name="price"
            type="number"
            required
            min="0"
            step="0.01"
            defaultValue={(item.price_cents / 100).toFixed(2)}
            className={`${inputClass} w-24`}
          />
          <button
            type="submit"
            disabled={editPending}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Save
          </button>
        </form>
        <form action={toggleAction}>
          <input type="hidden" name="id" value={item.id} />
          <input
            type="hidden"
            name="available"
            value={item.available ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={togglePending}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {item.available ? "Mark unavailable" : "Mark available"}
          </button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded border border-red-300 px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </form>
      </div>
      {item.variants.length > 0 && (
        <p className="mt-2 font-mono text-xs text-neutral-500">
          variants: {JSON.stringify(item.variants)}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}

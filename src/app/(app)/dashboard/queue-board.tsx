"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { orderAction } from "./actions";

export type QueueOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  status: "pending" | "accepted" | "ready";
  notes: string | null;
  placed_at: string;
  order_items: {
    id: string;
    item_name: string;
    unit_price_cents: number;
    qty: number;
  }[];
};

const OPEN_STATUSES = ["pending", "accepted", "ready"];

const ORDER_SELECT =
  "id, customer_name, customer_phone, status, notes, placed_at, order_items (id, item_name, unit_price_cents, qty)";

const NEXT_ACTIONS: Record<QueueOrder["status"], { action: string; label: string; danger?: boolean }[]> = {
  pending: [
    { action: "accept", label: "Accept" },
    { action: "reject", label: "Reject", danger: true },
  ],
  accepted: [{ action: "ready", label: "Mark ready" }],
  ready: [{ action: "complete", label: "Complete" }],
};

const STATUS_BADGE: Record<QueueOrder["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function QueueBoard({
  businessId,
  initialOrders,
}: {
  businessId: string;
  initialOrders: QueueOrder[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [supabase] = useState(createClient);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("business_id", businessId)
      .in("status", OPEN_STATUSES)
      .order("placed_at");
    if (data) setOrders(data as QueueOrder[]);
  }, [businessId, supabase]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`orders-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          // Debounce: the agent writes order + items + event in quick
          // succession; one refetch after the burst is enough.
          clearTimeout(timer);
          timer = setTimeout(refetch, 250);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [businessId, refetch, supabase]);

  function act(orderId: string, action: string) {
    setError(null);
    startTransition(async () => {
      const result = await orderAction(orderId, action);
      if (result.error) setError(result.error);
      // Refetch immediately so the click never waits on the socket.
      await refetch();
    });
  }

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Order queue</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No open orders. New phone orders appear here live.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order, index) => {
            const total = order.order_items.reduce(
              (sum, line) => sum + line.unit_price_cents * line.qty,
              0,
            );
            return (
              <li
                key={order.id}
                className="rounded border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-neutral-500">
                    #{index + 1}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[order.status]}`}
                  >
                    {order.status}
                  </span>
                  <span className="text-sm font-medium">
                    {order.customer_name ?? "Customer"} ·{" "}
                    {order.customer_phone}
                  </span>
                  <span className="ml-auto text-xs text-neutral-500">
                    {new Date(order.placed_at).toLocaleTimeString()}
                  </span>
                </div>
                <ul className="mt-2 text-sm">
                  {order.order_items.map((line) => (
                    <li key={line.id}>
                      {line.qty} × {line.item_name} @{" "}
                      {dollars(line.unit_price_cents)}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {dollars(total)}
                  </span>
                  {order.notes && (
                    <span className="text-sm text-neutral-500">
                      “{order.notes}”
                    </span>
                  )}
                  <span className="ml-auto flex gap-2">
                    {NEXT_ACTIONS[order.status].map(({ action, label, danger }) => (
                      <button
                        key={action}
                        disabled={pending}
                        onClick={() => act(order.id, action)}
                        className={`rounded border px-3 py-1 text-sm disabled:opacity-50 ${
                          danger
                            ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                            : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

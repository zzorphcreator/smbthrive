import { requireBusiness } from "@/lib/auth";
import { QueueBoard, type QueueOrder } from "./queue-board";

export default async function DashboardPage() {
  const { db, business } = await requireBusiness();
  const { data: orders, error } = await db
    .from("orders")
    .select(
      "id, customer_name, customer_phone, status, notes, placed_at, order_items (id, item_name, unit_price_cents, qty)",
    )
    .eq("business_id", business.id)
    .in("status", ["pending", "accepted", "ready"])
    .order("placed_at");
  if (error) throw error;

  return (
    <QueueBoard
      businessId={business.id}
      initialOrders={orders as QueueOrder[]}
    />
  );
}

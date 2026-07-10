import { requireBusiness } from "@/lib/auth";
import { CreateItemForm } from "./create-item-form";
import { ItemRow, type CatalogItem } from "./item-row";

export default async function CatalogPage() {
  const { db, business } = await requireBusiness();
  const { data: items, error } = await db
    .from("catalog_items")
    .select("id, name, description, price_cents, variants, available")
    .eq("business_id", business.id)
    .order("name");
  if (error) throw error;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Catalog</h1>
      <CreateItemForm />
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No items yet. Add your menu above — the receptionist only offers
          what&apos;s listed here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(items as CatalogItem[]).map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}

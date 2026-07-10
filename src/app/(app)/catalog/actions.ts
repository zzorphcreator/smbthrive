"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CatalogState = { error: string } | null;

// Server actions are directly POSTable, so each one re-verifies auth; RLS
// backstops every write (catalog_items policies are owner-scoped).
async function ownerClient() {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) redirect("/login");
  return db;
}

const itemFields = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z
    .string()
    .trim()
    .transform((s) => s || null),
  // Dollars in the form, cents in the database.
  price: z.coerce.number().min(0, "Price must be 0 or more"),
});

export async function createItem(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const db = await ownerClient();
  const parsed = itemFields.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
  });
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };

  const { data: business } = await db
    .from("businesses")
    .select("id")
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { error } = await db.from("catalog_items").insert({
    business_id: business.id,
    name: parsed.data.name,
    description: parsed.data.description,
    price_cents: Math.round(parsed.data.price * 100),
  });
  if (error) return { error: error.message };
  revalidatePath("/catalog");
  return null;
}

export async function updateItem(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const db = await ownerClient();
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = itemFields.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
  });
  if (!id.success || !parsed.success) {
    return { error: parsed.success ? "Bad item id" : z.prettifyError(parsed.error) };
  }

  const { error } = await db
    .from("catalog_items")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      price_cents: Math.round(parsed.data.price * 100),
    })
    .eq("id", id.data);
  if (error) return { error: error.message };
  revalidatePath("/catalog");
  return null;
}

export async function toggleItem(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const db = await ownerClient();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Bad item id" };
  const available = formData.get("available") === "true";

  const { error } = await db
    .from("catalog_items")
    .update({ available })
    .eq("id", id.data);
  if (error) return { error: error.message };
  revalidatePath("/catalog");
  return null;
}

export async function deleteItem(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const db = await ownerClient();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Bad item id" };

  const { error } = await db.from("catalog_items").delete().eq("id", id.data);
  if (error) {
    // 23503: order_items reference this item (no cascade, by design —
    // order history keeps its snapshot). Suggest the reversible path.
    if (error.code === "23503") {
      return {
        error:
          "This item has past orders and can't be deleted. Mark it unavailable instead.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/catalog");
  return null;
}

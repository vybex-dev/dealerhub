"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSubdomain, requireMember } from "@/lib/tenant";
import { buildSlug, publicId, rupeesToMinor } from "@/lib/format";

const num = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional());
const schema = z.object({
  title: z.string().min(5, "Title needs at least 5 characters").max(140),
  listing_type: z.enum(["sale", "rent"]),
  category: z.enum(["apartment", "house", "plot", "commercial"]),
  description: z.string().max(5000).optional(),
  price: num, bedrooms: num, bathrooms: num, builtup_area: num,
  locality: z.string().max(120).optional(), city: z.string().max(80).optional(), state: z.string().max(80).optional(),
  furnishing: z.enum(["", "unfurnished", "semi", "furnished"]).optional(),
  construction_status: z.enum(["ready_to_move", "under_construction"]),
});

export type FormState = { error?: string } | null;

export async function createProperty(_: FormState, fd: FormData): Promise<FormState> {
  const { tenant, sb } = await requireMember(currentSubdomain()); // membership checked against hostname's tenant
  const intent = fd.get("intent") === "publish" ? "publish" : "draft";
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  if (intent === "publish") {
    const missing = [];
    if (!d.price) missing.push("price"); if (!d.city) missing.push("city"); if (!d.locality) missing.push("locality");
    if (missing.length) return { error: `To publish, add: ${missing.join(", ")}.` };
    if (tenant.status !== "active") return { error: "Your site is not active, so listings cannot be published." };
  }

  const pid = publicId();
  const now = new Date().toISOString();
  const { error } = await sb.from("properties").insert({
    tenant_id: tenant.id, public_id: pid, slug: buildSlug(d.title, pid), title: d.title,
    listing_type: d.listing_type, category: d.category, description: d.description || null,
    price_minor: d.price != null ? rupeesToMinor(d.price) : null,
    bedrooms: d.bedrooms ?? null, bathrooms: d.bathrooms ?? null, builtup_area: d.builtup_area ?? null,
    locality: d.locality || null, city: d.city || null, state: d.state || null,
    furnishing: d.furnishing || null, construction_status: d.construction_status,
    publication_status: intent === "publish" ? "published" : "draft",
    published_at: intent === "publish" ? now : null, first_published_at: intent === "publish" ? now : null,
  });
  if (error) return { error: "Could not save the property. Try again." };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function setPublication(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const id = String(fd.get("id")); const to = String(fd.get("to"));
  if (!["published", "unpublished", "archived"].includes(to)) return;
  const patch: Record<string, unknown> = { publication_status: to };
  if (to === "published") {
    if (tenant.status !== "active") return;
    const { data: cur } = await sb.from("properties").select("first_published_at,price_minor,city,locality").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
    if (!cur || !cur.price_minor || !cur.city || !cur.locality) return;
    patch.published_at = new Date().toISOString();
    if (!cur.first_published_at) patch.first_published_at = patch.published_at;
  }
  await sb.from("properties").update(patch).eq("id", id).eq("tenant_id", tenant.id); // RLS also enforces this
  revalidatePath("/", "layout");
}

export async function setLeadStatus(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const status = String(fd.get("status"));
  if (!["new","contacted","visit_requested","visit_scheduled","closed","not_interested"].includes(status)) return;
  await sb.from("leads").update({ status }).eq("id", String(fd.get("id"))).eq("tenant_id", tenant.id);
  revalidatePath("/", "layout");
}

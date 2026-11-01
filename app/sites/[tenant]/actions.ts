"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSubdomain, requireMember } from "@/lib/tenant";
import { buildSlug, publicId, rupeesToMinor } from "@/lib/format";
import { deleteVariants } from "@/lib/images";

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
export type FormState = { error?: string; ok?: string } | null;

type SB = Awaited<ReturnType<typeof requireMember>>["sb"];
// Everything required before a listing can go public.
async function publishProblems(sb: SB, tenantId: string, tenantStatus: string, propertyId: string, v: { price_minor: number | null; city: string | null; locality: string | null }) {
  const missing: string[] = [];
  if (!v.price_minor) missing.push("price"); if (!v.city) missing.push("city"); if (!v.locality) missing.push("locality");
  const { count } = await sb.from("property_images").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("tenant_id", tenantId).eq("status", "ready").eq("kind", "photo");
  if (!count) missing.push("at least one photo");
  if (missing.length) return `To publish, add: ${missing.join(", ")}.`;
  if (tenantStatus !== "active") return "Your site is not active, so listings cannot be published.";
  return null;
}

const toRow = (d: z.infer<typeof schema>) => ({
  title: d.title, listing_type: d.listing_type, category: d.category, description: d.description || null,
  price_minor: d.price != null ? rupeesToMinor(d.price) : null,
  bedrooms: d.bedrooms ?? null, bathrooms: d.bathrooms ?? null, builtup_area: d.builtup_area ?? null,
  locality: d.locality || null, city: d.city || null, state: d.state || null,
  furnishing: d.furnishing || null, construction_status: d.construction_status,
});

export async function createProperty(_: FormState, fd: FormData): Promise<FormState> {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const pid = publicId();
  const { data, error } = await sb.from("properties").insert({
    ...toRow(p.data), tenant_id: tenant.id, public_id: pid, slug: buildSlug(p.data.title, pid), publication_status: "draft",
  }).select("id").single();
  if (error || !data) return { error: "Could not save the property. Try again." };
  redirect(`/dashboard/properties/${data.id}/edit?added=1`); // photos next
}

export async function updateProperty(_: FormState, fd: FormData): Promise<FormState> {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const id = String(fd.get("id"));
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: cur } = await sb.from("properties").select("id,first_published_at").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!cur) return { error: "Property not found." };
  const row = toRow(p.data); // slug and public_id are never touched: the public URL stays stable
  const patch: Record<string, unknown> = { ...row };
  if (fd.get("intent") === "publish") {
    const problem = await publishProblems(sb, tenant.id, tenant.status, id, row);
    if (problem) return { error: problem };
    const now = new Date().toISOString();
    Object.assign(patch, { publication_status: "published", published_at: now, first_published_at: cur.first_published_at ?? now });
  }
  const { error } = await sb.from("properties").update(patch).eq("id", id).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save changes. Try again." };
  revalidatePath("/", "layout");
  return { ok: fd.get("intent") === "publish" ? "Published." : "Saved." };
}

export async function setPublication(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const id = String(fd.get("id")); const to = String(fd.get("to"));
  if (!["published", "unpublished", "archived"].includes(to)) return;
  const patch: Record<string, unknown> = { publication_status: to };
  if (to === "published") {
    const { data: cur } = await sb.from("properties").select("first_published_at,price_minor,city,locality").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
    if (!cur || await publishProblems(sb, tenant.id, tenant.status, id, cur)) return;
    patch.published_at = new Date().toISOString();
    if (!cur.first_published_at) patch.first_published_at = patch.published_at;
  }
  await sb.from("properties").update(patch).eq("id", id).eq("tenant_id", tenant.id);
  revalidatePath("/", "layout");
}

export async function setLeadStatus(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const status = String(fd.get("status"));
  if (!["new","contacted","visit_requested","visit_scheduled","closed","not_interested"].includes(status)) return;
  await sb.from("leads").update({ status }).eq("id", String(fd.get("id"))).eq("tenant_id", tenant.id);
  revalidatePath("/", "layout");
}

// ---- Media actions: every query is scoped to the hostname's tenant AND enforced by RLS ----
export async function setCover(fd: FormData) {
  const { sb } = await requireMember(currentSubdomain());
  await sb.rpc("set_cover", { p_image: String(fd.get("id")) });
  revalidatePath("/", "layout");
}

export async function moveImage(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const id = String(fd.get("id")); const dir = fd.get("dir") === "up" ? -1 : 1;
  const { data: me } = await sb.from("property_images").select("id,property_id").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!me) return;
  const { data: all } = await sb.from("property_images").select("id").eq("property_id", me.property_id).eq("tenant_id", tenant.id).eq("kind", "photo").order("sort_order").order("created_at");
  if (!all) return;
  const ids = all.map((r) => r.id); const i = ids.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, n) => sb.from("property_images").update({ sort_order: n }).eq("id", x).eq("tenant_id", tenant.id)));
  revalidatePath("/", "layout");
}

export async function saveCaption(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const caption = String(fd.get("caption") ?? "").trim().slice(0, 80) || null;
  await sb.from("property_images").update({ caption }).eq("id", String(fd.get("id"))).eq("tenant_id", tenant.id);
  revalidatePath("/", "layout");
}

export async function deleteImage(fd: FormData) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const id = String(fd.get("id"));
  // Ownership is proven by the row itself (tenant-scoped); each image owns its own key prefix, so nothing shared is removed.
  const { data: img } = await sb.from("property_images").select("id,property_id,is_cover").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!img) return;
  const { error } = await sb.from("property_images").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (error) return;
  await deleteVariants(tenant.id, id);
  if (img.is_cover) {
    const { data: next } = await sb.from("property_images").select("id").eq("property_id", img.property_id).eq("status", "ready").eq("kind", "photo").order("sort_order").limit(1).maybeSingle();
    if (next) await sb.rpc("set_cover", { p_image: next.id });
  }
  revalidatePath("/", "layout");
}

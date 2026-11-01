import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, maxPhotos, maxStorage, presignUpload } from "@/lib/images";

const schema = z.object({
  property_id: z.string().uuid(), filename: z.string().max(200),
  content_type: z.string().refine((t) => ALLOWED_TYPES.includes(t), "Only JPEG, PNG or WebP photos are allowed."),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "This photo is larger than 8 MB."),
});

export async function POST(req: Request) {
  const sub = headers().get("x-tenant-subdomain");
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: tenant } = await sb.from("tenants").select("id,status").eq("subdomain", sub).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: m } = await sb.from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle();
  if (!m) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (tenant.status !== "active") return NextResponse.json({ error: "Your site is not active." }, { status: 403 });

  // Property must belong to this tenant (RLS also enforces it).
  const { data: prop } = await sb.from("properties").select("id").eq("id", p.data.property_id).eq("tenant_id", tenant.id).is("deleted_at", null).maybeSingle();
  if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { count } = await sb.from("property_images").select("id", { count: "exact", head: true }).eq("property_id", prop.id).eq("kind", "photo");
  if ((count ?? 0) >= maxPhotos()) return NextResponse.json({ error: `You can add up to ${maxPhotos()} photos per property.` }, { status: 409 });
  const { data: used } = await sb.rpc("tenant_storage_bytes", { t: tenant.id });
  if (Number(used ?? 0) + p.data.size > maxStorage()) return NextResponse.json({ error: "Storage limit reached. Remove photos or upgrade your plan." }, { status: 409 });

  const { data: last } = await sb.from("property_images").select("sort_order").eq("property_id", prop.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data: row, error } = await sb.from("property_images").insert({
    tenant_id: tenant.id, property_id: prop.id, status: "pending", sort_order: (last?.sort_order ?? -1) + 1,
    storage_bytes: p.data.size, original_name: p.data.filename.slice(0, 200),
  }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });

  const url = await presignUpload(tenant.id, row.id, p.data.content_type, p.data.size);
  return NextResponse.json({ image_id: row.id, upload_url: url, content_type: p.data.content_type });
}

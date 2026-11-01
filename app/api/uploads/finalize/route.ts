import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { ImageError, deleteRaw, processImage, putVariants, readRaw } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const sub = headers().get("x-tenant-subdomain");
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = z.object({ image_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: tenant } = await sb.from("tenants").select("id").eq("subdomain", sub).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RLS limits this to the caller's own tenant; the explicit tenant_id check ties it to the hostname's tenant.
  const { data: img } = await sb.from("property_images").select("id,property_id,status").eq("id", p.data.image_id).eq("tenant_id", tenant.id).maybeSingle();
  if (!img || img.status !== "pending") return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  const fail = async (msg: string, code = 422) => {
    await deleteRaw(tenant.id, img.id);
    await sb.from("property_images").delete().eq("id", img.id).eq("tenant_id", tenant.id);
    return NextResponse.json({ error: msg }, { status: code });
  };

  const raw = await readRaw(tenant.id, img.id);
  if (!raw) return fail("The upload did not arrive. Try again.", 400);
  try {
    const out = await processImage(raw);
    await putVariants(tenant.id, img.id, out.variants);
    await deleteRaw(tenant.id, img.id);
    const { data: hasCover } = await sb.from("property_images").select("id").eq("property_id", img.property_id).eq("is_cover", true).limit(1).maybeSingle();
    await sb.from("property_images").update({
      status: "ready", width: out.width, height: out.height, storage_bytes: out.bytes, is_cover: !hasCover,
    }).eq("id", img.id).eq("tenant_id", tenant.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ImageError) return fail(e.message);
    return fail("Could not process this photo. Try another file.", 500);
  }
}

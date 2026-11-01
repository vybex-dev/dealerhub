import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteRaw } from "@/lib/images";

// Removes abandoned uploads: pending rows older than 1 hour (the signed URL expires after 5 minutes).
export const runtime = "nodejs";
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  const { data: stale } = await sb.from("property_images").select("id,tenant_id").neq("status", "ready").lt("created_at", cutoff).limit(500);
  for (const r of stale ?? []) { await deleteRaw(r.tenant_id, r.id); await sb.from("property_images").delete().eq("id", r.id); }
  return NextResponse.json({ removed: stale?.length ?? 0 });
}

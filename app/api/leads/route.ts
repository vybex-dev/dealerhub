import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { idFromSlug } from "@/lib/format";

const CONSENT_VERSION = "v1";
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  message: z.string().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the consent box" }) }),
  property_public_id: z.string().regex(/^[a-hj-km-np-z2-9]{6}$/),
  website: z.string().optional(), // honeypot
});

// PHASE 1 PLACEHOLDER: in-memory limiter works per server instance only (serverless = weak).
// Replace with Redis/Upstash + a bot challenge (e.g. Turnstile) before launch.
const hits = new Map<string, number[]>();
function limited(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = Date.now(); const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}

export async function POST(req: Request) {
  const sub = headers().get("x-tenant-subdomain"); // set by middleware from the hostname
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // bot: pretend success

  const ip = (headers().get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const ipHash = createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")).digest("hex").slice(0, 32);
  if (limited(`ip:${ipHash}`) || limited(`ph:${sub}:${d.phone}`, 3)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const sb = supabaseAdmin();
  const { data: tenant } = await sb.from("tenants").select("id,status").eq("subdomain", sub).maybeSingle();
  if (!tenant || tenant.status !== "active") return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Property must belong to THIS tenant and be published.
  const { data: prop } = await sb.from("properties").select("id").eq("tenant_id", tenant.id)
    .eq("public_id", d.property_public_id).eq("publication_status", "published").is("deleted_at", null).maybeSingle();
  if (!prop) return NextResponse.json({ error: "This property is no longer available." }, { status: 404 });

  const { error } = await sb.from("leads").insert({
    tenant_id: tenant.id, property_id: prop.id, name: d.name, email: d.email || null, phone: d.phone,
    message: d.message || null, consent_at: new Date().toISOString(), consent_text_version: CONSENT_VERSION, ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: "Could not save your enquiry. Try again." }, { status: 500 });
  // TODO(Phase 6): queue transactional email to the dealer.
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { validateSubdomain } from "@/lib/host";
export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get("name") ?? "").toLowerCase();
  const bad = validateSubdomain(name);
  if (bad) return NextResponse.json({ available: false, reason: bad });
  const { data } = await supabaseServer().rpc("subdomain_available", { p_subdomain: name });
  return NextResponse.json({ available: data === true, reason: data === true ? undefined : "Already taken" });
}

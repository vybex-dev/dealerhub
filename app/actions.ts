"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { validateSubdomain } from "@/lib/host";
import { rootUrl, tenantUrl } from "@/lib/tenant";

const creds = z.object({ email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters") });

export async function signup(_: unknown, fd: FormData) {
  const p = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  const { data, error } = await supabaseServer().auth.signUp({ ...p.data, options: { emailRedirectTo: rootUrl("/onboarding") } });
  if (error) return { error: error.message };
  if (!data.session) return { ok: "Check your email to confirm your account, then log in." };
  redirect("/onboarding");
}

// Only allow redirects back to our own root domain or its subdomains.
function safeNext(next: string | null): string {
  try {
    if (!next) return "/onboarding";
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    const u = new URL(next);
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN!.split(":")[0];
    const h = u.hostname;
    if (h === root || h.endsWith("." + root)) return next;
  } catch {}
  return "/onboarding";
}

export async function login(_: unknown, fd: FormData) {
  const p = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: "Enter a valid email and password." };
  const { error } = await supabaseServer().auth.signInWithPassword(p.data);
  if (error) return { error: "Email or password is incorrect." };
  redirect(safeNext(String(fd.get("next") || "")));
}

export async function logout() {
  await supabaseServer().auth.signOut();
  redirect(rootUrl("/"));
}

const biz = z.object({
  business_name: z.string().min(2).max(120),
  subdomain: z.string(),
  contact_person: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
});

export async function createTenant(_: unknown, fd: FormData) {
  const p = biz.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Enter your business name (at least 2 characters)." };
  const bad = validateSubdomain(p.data.subdomain);
  if (bad) return { error: bad };
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await sb.rpc("create_tenant", {
    p_subdomain: p.data.subdomain, p_business_name: p.data.business_name,
    p_contact_person: p.data.contact_person || null, p_phone: p.data.phone || null, p_email: user.email,
  });
  if (error) {
    if (/taken/.test(error.message)) return { error: "That address is already taken. Try another." };
    if (/reserved/.test(error.message)) return { error: "That name is reserved. Choose another." };
    return { error: "Could not create your site. Try again." };
  }
  redirect(tenantUrl((data as { subdomain: string }).subdomain, "/dashboard"));
}

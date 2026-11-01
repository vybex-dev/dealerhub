import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Tenant = {
  id: string; subdomain: string; business_name: string; description: string | null;
  contact_person: string | null; business_email: string | null; phone: string | null; whatsapp: string | null; status: string;
};

export async function getTenant(subdomain: string): Promise<Tenant | null> {
  const { data } = await supabaseServer().from("tenants")
    .select("id,subdomain,business_name,description,contact_person,business_email,phone,whatsapp,status")
    .eq("subdomain", subdomain).maybeSingle();
  return (data as Tenant) ?? null;
}

export async function requireTenant(subdomain: string): Promise<Tenant> {
  const t = await getTenant(subdomain);
  if (!t) notFound();
  return t;
}

export const rootUrl = (path = "") => `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}${path}`;
export const tenantUrl = (sub: string, path = "") => `${process.env.NEXT_PUBLIC_PROTOCOL}://${sub}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}${path}`;

// Dashboard guard: must be signed in AND a member of the tenant that the HOSTNAME resolves to.
export async function requireMember(subdomain: string) {
  const tenant = await requireTenant(subdomain);
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(rootUrl(`/login?next=${encodeURIComponent(tenantUrl(subdomain, "/dashboard"))}`));
  const { data: m } = await sb.from("tenant_memberships").select("role").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle();
  if (!m) redirect(rootUrl("/login?error=no_access"));
  return { tenant, user, role: m.role as string, sb };
}

import { headers } from "next/headers";
// The tenant for server actions / API routes comes ONLY from the hostname (set by middleware), never from form fields.
export function currentSubdomain(): string {
  const s = headers().get("x-tenant-subdomain");
  if (!s) notFound();
  return s;
}

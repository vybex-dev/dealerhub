import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { supabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import PropertyCard from "@/components/PropertyCard";

export async function generateMetadata({ params }: { params: { tenant: string } }) {
  const t = await requireTenant(params.tenant);
  return { title: `${t.business_name} | Properties`, description: t.description ?? `Property listings from ${t.business_name}` };
}

export default async function TenantHome({ params, searchParams }: { params: { tenant: string }; searchParams: { type?: string; city?: string } }) {
  const t = await requireTenant(params.tenant);
  const sb = supabaseServer();
  let q = sb.from("properties").select("public_id,slug,title,price_minor,listing_type,locality,city,bedrooms,bathrooms,builtup_area,area_unit,availability,construction_status")
    .eq("tenant_id", t.id).eq("publication_status", "published").is("deleted_at", null).order("published_at", { ascending: false }).limit(48);
  if (searchParams.type === "sale" || searchParams.type === "rent") q = q.eq("listing_type", searchParams.type);
  if (searchParams.city) q = q.ilike("city", searchParams.city);
  const { data: props } = await q;
  return (<>
    <header className="topbar"><div className="wrap">
      <span className="brand"><i />{t.business_name}</span>
      <nav style={{display:"flex",gap:16,alignItems:"center"}}>
        {t.phone && <a href={`tel:${t.phone}`}>{t.phone}</a>}
        {t.whatsapp && <a href={`https://wa.me/${t.whatsapp.replace(/\D/g, "")}`}>WhatsApp</a>}
      </nav>
    </div></header>
    <main className="wrap" style={{paddingTop:40}}>
      <h1>{t.business_name}</h1>
      {t.description && <p style={{color:"var(--muted)",maxWidth:"70ch"}}>{t.description}</p>}
      <h2 style={{marginTop:32}}>Properties</h2>
      <form method="get" style={{display:"flex",gap:12,flexWrap:"wrap",margin:"12px 0 24px"}}>
        <select name="type" defaultValue={searchParams.type ?? ""} aria-label="Sale or rent" style={{width:"auto"}}>
          <option value="">Sale or rent</option><option value="sale">For sale</option><option value="rent">For rent</option>
        </select>
        <input name="city" placeholder="City" defaultValue={searchParams.city ?? ""} aria-label="City" style={{width:200}} />
        <button className="btn" type="submit">Search</button>
      </form>
      {props && props.length > 0
        ? <div className="grid">{props.map((p) => <PropertyCard key={p.public_id} p={p} />)}</div>
        : <p>No properties match right now. Check back soon.</p>}
    </main>
    <footer><div className="wrap">© {new Date().getFullYear()} {t.business_name}. Powered by DealerHub.</div></footer>
  </>);
}

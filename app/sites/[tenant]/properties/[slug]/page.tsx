import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { supabaseServer } from "@/lib/supabase/server";
import { formatPrice, idFromSlug } from "@/lib/format";
import EnquiryForm from "@/components/EnquiryForm";
import PropertyCard from "@/components/PropertyCard";

async function load(tenantId: string, slug: string) {
  const pid = idFromSlug(slug); if (!pid) return null;
  const { data } = await supabaseServer().from("properties").select("*")
    .eq("tenant_id", tenantId).eq("public_id", pid).eq("publication_status", "published").is("deleted_at", null).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { tenant: string; slug: string } }) {
  const t = await requireTenant(params.tenant); const p = await load(t.id, params.slug);
  if (!p) return { title: "Property not found", robots: { index: false } };
  return { title: `${p.title} | ${t.business_name}`, description: (p.description ?? "").slice(0, 155) || `${p.title} in ${p.locality ?? ""} ${p.city ?? ""}` };
}

const FURN: Record<string, string> = { unfurnished: "Unfurnished", semi: "Semi furnished", furnished: "Furnished" };

export default async function PropertyPage({ params }: { params: { tenant: string; slug: string } }) {
  const t = await requireTenant(params.tenant);
  const p = await load(t.id, params.slug);
  if (!p) notFound();
  if (p.slug !== params.slug) permanentRedirect(`/properties/${p.slug}`); // stable URL: canonical slug

  const days = p.first_published_at ? Math.max(0, Math.floor((Date.now() - new Date(p.first_published_at).getTime()) / 86400000)) : null;
  const overview: [string, string | number | null][] = [
    ["BHK", p.bedrooms], ["Baths", p.bathrooms],
    ["Built-up area", p.builtup_area ? `${p.builtup_area} ${p.area_unit === "sqm" ? "Sq M" : "Sq Ft"}` : null],
    ["Furnishing", p.furnishing ? FURN[p.furnishing] : null], ["Category", p.category],
  ];
  const rows = overview.filter(([, v]) => v != null && v !== "");
  const { data: similar } = await supabaseServer().from("properties")
    .select("public_id,slug,title,price_minor,listing_type,locality,city,bedrooms,bathrooms,builtup_area,area_unit,availability,construction_status")
    .eq("tenant_id", t.id).eq("publication_status", "published").is("deleted_at", null).neq("id", p.id).eq("listing_type", p.listing_type).limit(4);

  const nav = [rows.length && "Overview", p.description && "Property Info", "Price", p.locality && "Location", similar?.length && "Similar Properties"].filter(Boolean) as string[];
  const id = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

  return (<>
    <header className="topbar"><div className="wrap"><Link href="/" className="brand"><i />{t.business_name}</Link>{t.phone && <a href={`tel:${t.phone}`}>{t.phone}</a>}</div></header>
    <main className="wrap" style={{paddingTop:20}}>
      <nav aria-label="Breadcrumb" style={{fontSize:".9rem",color:"var(--muted)"}}>
        <Link href="/">Home</Link> / <Link href={`/?type=${p.listing_type}`}>{p.listing_type === "sale" ? "For sale" : "For rent"}</Link> / {p.title}
      </nav>
      <nav aria-label="Sections" style={{display:"flex",gap:20,overflowX:"auto",borderBottom:"1px solid var(--line)",margin:"14px 0 20px"}}>
        {nav.map((n) => <a key={n} href={`#${id(n)}`} style={{padding:"10px 0",whiteSpace:"nowrap",textDecoration:"none"}}>{n}</a>)}
      </nav>
      <div className="two">
        <div>
          <div className="card" style={{aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",position:"relative"}}>
            <span className="badge">{p.listing_type === "sale" ? "For sale" : "For rent"}</span>Photo gallery arrives in the next phase
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",margin:"22px 0"}}>
            <div className="price" style={{fontSize:"2rem"}}>{formatPrice(p.price_minor)}</div>
            <div style={{maxWidth:420}}><h1 style={{fontSize:"1.15rem",margin:0}}>{p.title}</h1>
              <div style={{color:"var(--muted)",fontSize:".9rem"}}>{[p.locality, p.city, p.state].filter(Boolean).join(", ")}</div></div>
          </div>
          {rows.length > 0 && <section id="overview" style={{marginBottom:32}}><h2>Overview</h2>
            <div className="kv">{rows.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></section>}
          {p.description && <section id="property-info" style={{marginBottom:32}}><h2>Property Info</h2>
            <p style={{whiteSpace:"pre-wrap"}}>{p.description}</p>
            <p style={{fontSize:".85rem",color:"var(--muted)"}}><strong>Disclaimer:</strong> Details and measurements are entered by the dealer and are subject to verification from official documents.</p></section>}
          <section id="price" style={{marginBottom:32}}><h2>Price</h2>
            <div className="card pad" style={{display:"flex",justifyContent:"space-between"}}><strong>Asking price</strong><strong>{p.price_minor != null ? `₹${new Intl.NumberFormat("en-IN").format(p.price_minor / 100)}` : "On request"}</strong></div></section>
          {p.locality && <section id="location" style={{marginBottom:32}}><h2>Location</h2><p>{[p.locality, p.city, p.state].filter(Boolean).join(", ")}</p></section>}
          {similar && similar.length > 0 && <section id="similar-properties"><h2>Similar Properties</h2><div className="grid">{similar.map((s) => <PropertyCard key={s.public_id} p={s} />)}</div></section>}
        </div>
        <aside>
          <div className="card" style={{marginBottom:20}}><div className="kv" style={{gridTemplateColumns:"1fr",padding:"4px 18px"}}>
            <div><span>Listing status</span><strong>{p.availability}</strong></div>
            {days != null && <div><span>Days on market</span><strong>{days}</strong></div>}
            <div><span>Property type</span><strong>{p.category}</strong></div>
            <div><span>Status</span><strong>{p.construction_status === "ready_to_move" ? "Ready to move" : "Under construction"}</strong></div>
            {p.locality && <div><span>Locality</span><strong>{p.locality}</strong></div>}
            {p.city && <div><span>City</span><strong>{p.city}</strong></div>}
          </div></div>
          <div className="card pad" style={{marginBottom:20}}><h2>Contact {t.business_name}</h2><EnquiryForm propertyId={p.public_id} dealerName={t.business_name} /></div>
          <div className="card pad"><h3>{t.contact_person ?? t.business_name}</h3><div>{t.business_name}</div>
            {t.phone && <div><a href={`tel:${t.phone}`}>{t.phone}</a></div>}{t.business_email && <div><a href={`mailto:${t.business_email}`}>{t.business_email}</a></div>}</div>
        </aside>
      </div>
    </main>
    <footer><div className="wrap">© {new Date().getFullYear()} {t.business_name}. Powered by DealerHub.</div></footer>
  </>);
}

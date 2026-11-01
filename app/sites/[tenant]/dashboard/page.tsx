import Link from "next/link";
import { currentSubdomain, requireMember, rootUrl } from "@/lib/tenant";
import { formatPrice } from "@/lib/format";
import { setPublication, setLeadStatus } from "../actions";
import { logout } from "@/app/actions";
export const dynamic = "force-dynamic";

const STATUSES = ["new","contacted","visit_requested","visit_scheduled","closed","not_interested"];

export default async function Dashboard() {
  const { tenant, sb } = await requireMember(currentSubdomain());
  const [{ data: props }, { data: leads }] = await Promise.all([
    sb.from("properties").select("id,title,slug,price_minor,publication_status,availability,listing_type").eq("tenant_id", tenant.id).is("deleted_at", null).order("created_at", { ascending: false }),
    sb.from("leads").select("id,name,phone,email,message,status,created_at,properties(title)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const count = (s: string) => props?.filter((p) => p.publication_status === s).length ?? 0;
  return (<>
    <header className="topbar"><div className="wrap">
      <span className="brand"><i />{tenant.business_name} dashboard</span>
      <nav style={{display:"flex",gap:12,alignItems:"center"}}><Link href="/" target="_blank">View site</Link>
        <form action={logout}><button className="btn ghost" type="submit">Log out</button></form></nav>
    </div></header>
    <main className="wrap" style={{paddingTop:28}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:28}}>
        {[["Published", count("published")],["Drafts", count("draft")],["Archived", count("archived")],["New leads", leads?.filter((l) => l.status === "new").length ?? 0]].map(([k, v]) =>
          <div key={String(k)} className="card pad"><div style={{color:"var(--muted)"}}>{k}</div><div className="price">{v}</div></div>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2>Properties</h2><Link className="btn" href="/dashboard/properties/new">Add property</Link></div>
      <div className="card" style={{overflowX:"auto",marginBottom:36}}><table>
        <thead><tr><th>Title</th><th>Price</th><th>Status</th><th></th></tr></thead>
        <tbody>{props?.length ? props.map((p) => (
          <tr key={p.id}><td>{p.publication_status === "published" ? <Link href={`/properties/${p.slug}`}>{p.title}</Link> : p.title}</td>
            <td>{formatPrice(p.price_minor)}</td><td><span className="pill">{p.publication_status}</span></td>
            <td><form action={setPublication} style={{display:"flex",gap:8,alignItems:"center"}}><Link href={`/dashboard/properties/${p.id}/edit`}>Edit</Link><input type="hidden" name="id" value={p.id} />
              {p.publication_status !== "published" && <button className="btn" name="to" value="published">Publish</button>}
              {p.publication_status === "published" && <button className="btn ghost" name="to" value="unpublished">Unpublish</button>}
              {p.publication_status !== "archived" && <button className="btn ghost" name="to" value="archived">Archive</button>}
            </form></td></tr>)) : <tr><td colSpan={4}>No properties yet. Add your first listing.</td></tr>}</tbody>
      </table></div>
      <h2>Enquiries</h2>
      <div className="card" style={{overflowX:"auto"}}><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Property</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>{leads?.length ? leads.map((l: any) => (
          <tr key={l.id}><td>{l.name}</td><td>{l.phone}{l.email ? <><br />{l.email}</> : null}</td><td>{l.properties?.title ?? "-"}</td><td>{l.message ?? ""}</td>
            <td><form action={setLeadStatus}><input type="hidden" name="id" value={l.id} />
              <select name="status" defaultValue={l.status} aria-label="Lead status" onChange={undefined}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
              <button className="btn ghost" style={{marginTop:6}}>Update</button></form></td></tr>)) : <tr><td colSpan={5}>No enquiries yet.</td></tr>}</tbody>
      </table></div>
    </main>
  </>);
}

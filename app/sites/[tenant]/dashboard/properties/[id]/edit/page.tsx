import Link from "next/link";
import { notFound } from "next/navigation";
import { currentSubdomain, requireMember } from "@/lib/tenant";
import PropertyForm from "@/components/PropertyForm";
import MediaManager from "@/components/MediaManager";
export const dynamic = "force-dynamic";

export default async function EditProperty({ params, searchParams }: { params: { id: string }; searchParams: { added?: string } }) {
  const { tenant, sb } = await requireMember(currentSubdomain());
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const { data: p } = await sb.from("properties").select("*").eq("id", params.id).eq("tenant_id", tenant.id).is("deleted_at", null).maybeSingle();
  if (!p) notFound();
  const { data: images } = await sb.from("property_images").select("id,tenant_id,is_cover,sort_order,caption,status,kind").eq("property_id", p.id).eq("tenant_id", tenant.id).eq("kind", "photo").order("sort_order");
  return (<main className="wrap" style={{maxWidth:900,paddingTop:32}}>
    <p><Link href="/dashboard">Back to dashboard</Link></p>
    <h1>Edit property</h1>
    <p><span className="pill">{p.publication_status}</span> {p.publication_status === "published" && <Link href={`/properties/${p.slug}`} target="_blank">View public page</Link>}</p>
    {searchParams.added && <div className="msg ok" role="status">Property saved as a draft. Add photos below, then publish.</div>}
    <div className="card pad" style={{marginBottom:28}}><PropertyForm property={p} /></div>
    <h2>Photos</h2>
    <div className="card pad"><MediaManager propertyId={p.id} images={images ?? []} /></div>
  </main>);
}

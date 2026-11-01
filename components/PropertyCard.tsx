import Link from "next/link";
import { formatPrice } from "@/lib/format";
export default function PropertyCard({ p }: { p: any }) {
  const label = p.availability !== "available" ? p.availability : p.construction_status === "ready_to_move" ? "Ready to move" : "Under construction";
  return (
    <Link href={`/properties/${p.slug}`} className="card pcard">
      <div className="ph"><span className="badge">{label}</span><span>Photo coming soon</span></div>
      <div style={{padding:"16px 18px 18px"}}>
        <div className="price">{formatPrice(p.price_minor)} <span className="pill">{p.listing_type === "sale" ? "For sale" : "For rent"}</span></div>
        <div style={{fontWeight:600,color:"var(--navy)"}}>{p.title}</div>
        <div style={{color:"var(--muted)",fontSize:".9rem"}}>{[p.locality, p.city].filter(Boolean).join(", ")}</div>
        <div className="stats">
          <div>{p.bedrooms != null ? `${p.bedrooms} BHK` : "-"}</div>
          <div>{p.bathrooms != null ? `${p.bathrooms} Baths` : "-"}</div>
          <div>{p.builtup_area ? `${p.builtup_area} ${p.area_unit === "sqm" ? "Sq M" : "Sq Ft"}` : "-"}</div>
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { currentSubdomain, requireMember } from "@/lib/tenant";
import PropertyForm from "@/components/PropertyForm";
export const dynamic = "force-dynamic";
export default async function NewProperty() {
  await requireMember(currentSubdomain());
  return (<main className="wrap" style={{maxWidth:760,paddingTop:32}}>
    <p><Link href="/dashboard">Back to dashboard</Link></p>
    <h1>Add property</h1>
    <p style={{color:"var(--muted)"}}>You will add photos on the next screen.</p>
    <div className="card pad"><PropertyForm /></div>
  </main>);
}

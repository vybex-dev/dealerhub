import Link from "next/link";
export default function Home() {
  return (<>
    <header className="topbar"><div className="wrap">
      <Link href="/" className="brand"><i />DealerHub</Link>
      <nav style={{display:"flex",gap:12}}><Link className="btn ghost" href="/login">Log in</Link><Link className="btn" href="/signup">Create your site</Link></nav>
    </div></header>
    <main className="wrap hero">
      <h1>Your listings, on your own web address.</h1>
      <p>Pick a name like <strong>yourname.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}</strong>, add your properties, and share one link with buyers. Enquiries land in your dashboard.</p>
      <p style={{marginTop:24}}><Link className="btn gold" href="/signup">Create your site</Link></p>
      <p style={{fontSize:".9rem"}}>Pricing, features, support and legal pages arrive in a later phase.</p>
    </main>
  </>);
}

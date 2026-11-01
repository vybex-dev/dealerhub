import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { login } from "../actions";
export default function Login({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (<main className="wrap" style={{maxWidth:440,paddingTop:56}}>
    <h1 style={{fontSize:"2rem"}}>Log in</h1>
    {searchParams.error === "no_access" && <div className="msg err" role="alert">This account does not manage that site. Log in with the dealer account.</div>}
    <div className="card pad"><AuthForm action={login} label="Log in" next={searchParams.next} /></div>
    <p>New here? <Link href="/signup">Create your site</Link></p>
  </main>);
}

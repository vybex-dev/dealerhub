import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signup } from "../actions";
export default function Signup() {
  return (<main className="wrap" style={{maxWidth:440,paddingTop:56}}>
    <h1 style={{fontSize:"2rem"}}>Create your account</h1>
    <div className="card pad"><AuthForm action={signup} label="Create account" /></div>
    <p>Already have an account? <Link href="/login">Log in</Link></p>
  </main>);
}

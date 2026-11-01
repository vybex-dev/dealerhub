import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OnboardingForm from "@/components/OnboardingForm";
export default async function Onboarding() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) redirect("/login");
  return (<main className="wrap" style={{maxWidth:520,paddingTop:56}}>
    <h1 style={{fontSize:"2rem"}}>Set up your site</h1>
    <p style={{color:"var(--muted)"}}>Pick the address buyers will visit. Billing and plan selection come in a later phase.</p>
    <div className="card pad"><OnboardingForm rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN!} /></div>
  </main>);
}

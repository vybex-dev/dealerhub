"use client";
import { useFormState } from "react-dom";
import { useState, useEffect } from "react";
import { createTenant } from "@/app/actions";
export default function OnboardingForm({ rootDomain }: { rootDomain: string }) {
  const [state, action] = useFormState(createTenant, null as any);
  const [sub, setSub] = useState("");
  const [avail, setAvail] = useState<string>("");
  useEffect(() => {
    if (sub.length < 3) { setAvail(""); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/subdomain-check?name=${encodeURIComponent(sub)}`).then((r) => r.json()).catch(() => null);
      setAvail(r ? (r.available ? "Available" : r.reason ?? "Not available") : "");
    }, 350);
    return () => clearTimeout(t);
  }, [sub]);
  return (
    <form action={action}>
      <label htmlFor="business_name">Business name</label>
      <input id="business_name" name="business_name" required minLength={2} />
      <label htmlFor="subdomain">Your web address</label>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <input id="subdomain" name="subdomain" required value={sub} onChange={(e) => setSub(e.target.value.toLowerCase())} aria-describedby="avail" />
        <span style={{whiteSpace:"nowrap",color:"var(--muted)"}}>.{rootDomain}</span>
      </div>
      <div id="avail" aria-live="polite" style={{fontSize:".85rem",minHeight:"1.3em",color:avail === "Available" ? "var(--ok)" : "var(--danger)"}}>{avail}</div>
      <label htmlFor="contact_person">Contact person</label>
      <input id="contact_person" name="contact_person" />
      <label htmlFor="phone">Phone</label>
      <input id="phone" name="phone" type="tel" />
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      <p><button className="btn" type="submit">Create my site</button></p>
    </form>
  );
}

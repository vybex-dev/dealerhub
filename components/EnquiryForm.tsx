"use client";
import { useState } from "react";
export default function EnquiryForm({ propertyId, dealerName }: { propertyId: string; dealerName: string }) {
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setState({});
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd); (body as any).consent = fd.get("consent") === "on";
    const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, property_public_id: propertyId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setState({ ok: true }); (e.target as HTMLFormElement).reset(); } else setState({ error: j.error ?? "Could not send. Try again." });
  }
  if (state.ok) return <div className="msg ok" role="status">Thanks. {dealerName} has your enquiry and will get back to you. This is not a confirmed visit.</div>;
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="name">Full name</label><input id="name" name="name" required maxLength={120} autoComplete="name" />
      <label htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" autoComplete="email" />
      <label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required autoComplete="tel" />
      <label htmlFor="message">Message</label><textarea id="message" name="message" maxLength={1000} />
      <div className="hp" aria-hidden="true"><label>Leave empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label style={{display:"flex",gap:8,fontWeight:400,alignItems:"flex-start"}}>
        <input type="checkbox" name="consent" required style={{width:"auto",marginTop:4}} />
        <span>I agree that {dealerName} may contact me about this property and store my details for that purpose.</span>
      </label>
      {state.error && <div className="msg err" role="alert">{state.error}</div>}
      <button className="btn" type="submit" disabled={busy} style={{width:"100%"}}>{busy ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}

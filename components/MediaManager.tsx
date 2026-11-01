"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setCover, moveImage, saveCaption, deleteImage } from "@/app/sites/[tenant]/actions";
import { imgUrl, type ImgRow } from "@/lib/image-urls";

const OK = ["image/jpeg", "image/png", "image/webp"];
export default function MediaManager({ propertyId, images }: { propertyId: string; images: ImgRow[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState("");

  async function uploadOne(f: File): Promise<string | null> {
    if (!OK.includes(f.type)) return `${f.name}: only JPEG, PNG or WebP photos are allowed.`;
    if (f.size > 8 * 1024 * 1024) return `${f.name}: larger than 8 MB.`;
    const init = await fetch("/api/uploads/init", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, filename: f.name, content_type: f.type, size: f.size }) });
    const j = await init.json().catch(() => ({}));
    if (!init.ok) return `${f.name}: ${j.error ?? "could not start upload."}`;
    const put = await fetch(j.upload_url, { method: "PUT", headers: { "Content-Type": j.content_type }, body: f }).catch(() => null);
    if (!put || !put.ok) { await fetch("/api/uploads/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_id: j.image_id }) }); return `${f.name}: upload failed. Try again.`; }
    const fin = await fetch("/api/uploads/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_id: j.image_id }) });
    if (!fin.ok) return `${f.name}: ${(await fin.json().catch(() => ({}))).error ?? "could not process."}`;
    return null;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setBusy(true); setErrors([]); const errs: string[] = [];
    for (let i = 0; i < files.length; i++) { setProgress(`Uploading ${i + 1} of ${files.length}…`); const err = await uploadOne(files[i]); if (err) errs.push(err); }
    setBusy(false); setProgress(""); setErrors(errs); if (input.current) input.current.value = ""; router.refresh();
  }

  const ready = images.filter((i) => i.status === "ready").sort((a, b) => a.sort_order - b.sort_order);
  return (
    <div>
      <label htmlFor="photos">Add photos (JPEG, PNG or WebP, up to 8 MB each)</label>
      <input id="photos" ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={onPick} />
      <div aria-live="polite" style={{minHeight:"1.4em",color:"var(--muted)",fontSize:".9rem"}}>{progress}</div>
      {errors.map((e) => <div key={e} className="msg err" role="alert">{e}</div>)}
      {ready.length === 0 ? <p>No photos yet. Add at least one to publish.</p> :
        <ul style={{listStyle:"none",padding:0,display:"grid",gap:14,gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))"}}>
          {ready.map((im, i) => (
            <li key={im.id} className="card" style={{overflow:"hidden"}}>
              <img src={imgUrl(im, "thumb")} alt={im.caption ?? `Photo ${i + 1}`} loading="lazy" style={{width:"100%",aspectRatio:"3/2",objectFit:"cover",display:"block"}} />
              <div style={{padding:12}}>
                {im.is_cover ? <span className="pill" style={{background:"var(--gold-soft)",borderColor:"var(--gold)"}}>Cover</span>
                  : <form action={setCover}><input type="hidden" name="id" value={im.id} /><button className="btn ghost" style={{padding:".3em .8em"}}>Make cover</button></form>}
                <form action={saveCaption} style={{marginTop:8}}><input type="hidden" name="id" value={im.id} />
                  <input name="caption" defaultValue={im.caption ?? ""} placeholder="Caption, e.g. Kitchen" maxLength={80} aria-label={`Caption for photo ${i + 1}`} />
                  <button className="btn ghost" style={{padding:".3em .8em",marginTop:6}}>Save caption</button></form>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <form action={moveImage}><input type="hidden" name="id" value={im.id} /><input type="hidden" name="dir" value="up" /><button className="btn ghost" disabled={i === 0} aria-label="Move earlier" style={{padding:".3em .8em"}}>←</button></form>
                  <form action={moveImage}><input type="hidden" name="id" value={im.id} /><input type="hidden" name="dir" value="down" /><button className="btn ghost" disabled={i === ready.length - 1} aria-label="Move later" style={{padding:".3em .8em"}}>→</button></form>
                  <form action={deleteImage} style={{marginLeft:"auto"}}><input type="hidden" name="id" value={im.id} /><button className="btn ghost" style={{padding:".3em .8em",color:"var(--danger)",borderColor:"var(--danger)"}}>Delete</button></form>
                </div>
              </div>
            </li>))}
        </ul>}
    </div>
  );
}

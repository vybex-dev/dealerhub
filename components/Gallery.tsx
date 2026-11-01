"use client";
import { useState } from "react";
import { imgUrl, srcSet, type ImgRow } from "@/lib/image-urls";
export default function Gallery({ images, badge, title }: { images: ImgRow[]; badge: string; title: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="card" style={{aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",position:"relative"}}><span className="badge">{badge}</span>No photos yet</div>;
  const cur = images[i]; const go = (d: number) => setI((i + d + images.length) % images.length);
  const share = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title, url }); else await navigator.clipboard.writeText(url); } catch {} };
  const nav: React.CSSProperties = { position: "absolute", top: "50%", transform: "translateY(-50%)", background: "rgba(20,38,74,.7)", color: "#fff", border: 0, width: 36, height: 80, cursor: "pointer", fontSize: 20 };
  return (
    <div>
      <div style={{position:"relative",aspectRatio:"16/9",background:"var(--panel)",borderRadius:10,overflow:"hidden"}}>
        <img src={imgUrl(cur, "large")} srcSet={srcSet(cur)} sizes="(min-width:900px) 760px, 100vw" alt={cur.caption ?? `${title} photo ${i + 1}`}
          style={{width:"100%",height:"100%",objectFit:"cover"}} {...(i === 0 ? { fetchPriority: "high" as const } : {})} />
        <span className="badge">{badge}</span>
        {images.length > 1 && <><button aria-label="Previous photo" onClick={() => go(-1)} style={{...nav,left:0}}>‹</button><button aria-label="Next photo" onClick={() => go(1)} style={{...nav,right:0}}>›</button></>}
        {cur.caption && <span style={{position:"absolute",left:14,bottom:12,color:"#fff",fontWeight:600,textShadow:"0 1px 4px rgba(0,0,0,.7)"}}>{cur.caption}</span>}
        <button aria-label="Share this property" onClick={share} className="btn" style={{position:"absolute",right:12,bottom:12,padding:".4em .8em"}}>Share</button>
      </div>
      {images.length > 1 && <div style={{display:"flex",gap:8,marginTop:10,overflowX:"auto"}}>
        {images.map((im, n) => <button key={im.id} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-current={n === i} style={{border:n === i ? "2px solid var(--gold)" : "2px solid transparent",padding:0,borderRadius:8,background:"none",cursor:"pointer",flex:"0 0 auto"}}>
          <img src={imgUrl(im, "thumb")} alt="" loading="lazy" width={120} height={80} style={{objectFit:"cover",borderRadius:6,display:"block"}} /></button>)}
      </div>}
    </div>
  );
}

// Client-safe helpers (no sharp / AWS imports).
export type ImgRow = { id: string; tenant_id: string; is_cover: boolean; sort_order: number; caption: string | null; status: string; kind?: string };
export const imgUrl = (r: Pick<ImgRow, "id" | "tenant_id">, v: "thumb" | "medium" | "large") =>
  `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL}/tenants/${r.tenant_id}/img/${r.id}/${v}.webp`;
export const srcSet = (r: Pick<ImgRow, "id" | "tenant_id">) =>
  `${imgUrl(r, "thumb")} 320w, ${imgUrl(r, "medium")} 800w, ${imgUrl(r, "large")} 1600w`;
export const readyPhotos = (rows: ImgRow[] | null | undefined) =>
  (rows ?? []).filter((r) => r.status === "ready" && (r.kind ?? "photo") === "photo").sort((a, b) => a.sort_order - b.sort_order);
export const coverOf = (rows: ImgRow[] | null | undefined) => { const r = readyPhotos(rows); return r.find((x) => x.is_cover) ?? r[0] ?? null; };

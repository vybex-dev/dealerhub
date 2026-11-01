// Server-only: validation/processing (sharp) and R2 access.
import sharp from "sharp";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VARIANTS = { thumb: 320, medium: 800, large: 1600 } as const;
export type Variant = keyof typeof VARIANTS;
export const maxPhotos = () => Number(process.env.MAX_PHOTOS_PER_PROPERTY ?? 20);
export const maxStorage = () => Number(process.env.MAX_STORAGE_BYTES ?? 500 * 1024 * 1024);

export class ImageError extends Error {}

/** Verifies the real file content (not the filename/MIME), strips metadata, and builds WebP variants. */
export async function processImage(input: Buffer) {
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError("This photo is larger than 8 MB.");
  let format: string | undefined;
  try { format = (await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata()).format; }
  catch { throw new ImageError("This file is not a valid image."); }
  if (!format || !["jpeg", "png", "webp"].includes(format)) throw new ImageError("Only JPEG, PNG or WebP photos are allowed.");

  const variants = {} as Record<Variant, Buffer>;
  try {
    for (const [name, w] of Object.entries(VARIANTS) as [Variant, number][]) {
      // No .withMetadata(): sharp drops EXIF/GPS/ICC by default. rotate() applies EXIF orientation first.
      variants[name] = await sharp(input, { limitInputPixels: MAX_PIXELS })
        .rotate().resize({ width: w, height: w, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    }
  } catch { throw new ImageError("This image is too large or damaged to process."); }
  const m = await sharp(variants.large).metadata();
  const bytes = variants.thumb.length + variants.medium.length + variants.large.length;
  return { variants, width: m.width ?? 0, height: m.height ?? 0, bytes };
}

let _s3: S3Client | null = null;
export function s3() {
  return (_s3 ??= new S3Client({
    region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  }));
}
const PRIVATE = () => process.env.R2_BUCKET_PRIVATE!;
const PUBLIC = () => process.env.R2_BUCKET_PUBLIC!;
export const rawKey = (tenantId: string, imageId: string) => `tenants/${tenantId}/raw/${imageId}`;
export const variantKey = (tenantId: string, imageId: string, v: Variant) => `tenants/${tenantId}/img/${imageId}/${v}.webp`;

export const presignUpload = (tenantId: string, imageId: string, contentType: string, size: number) =>
  getSignedUrl(s3(), new PutObjectCommand({ Bucket: PRIVATE(), Key: rawKey(tenantId, imageId), ContentType: contentType, ContentLength: size }), { expiresIn: 300 });

export async function readRaw(tenantId: string, imageId: string): Promise<Buffer | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: PRIVATE(), Key: rawKey(tenantId, imageId) }));
    return Buffer.from(await r.Body!.transformToByteArray());
  } catch { return null; }
}
export const deleteRaw = (t: string, i: string) => s3().send(new DeleteObjectCommand({ Bucket: PRIVATE(), Key: rawKey(t, i) })).catch(() => {});
export async function putVariants(t: string, i: string, v: Record<Variant, Buffer>) {
  await Promise.all((Object.keys(v) as Variant[]).map((k) => s3().send(new PutObjectCommand({
    Bucket: PUBLIC(), Key: variantKey(t, i, k), Body: v[k], ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }))));
}
export const deleteVariants = (t: string, i: string) =>
  Promise.all((Object.keys(VARIANTS) as Variant[]).map((k) => s3().send(new DeleteObjectCommand({ Bucket: PUBLIC(), Key: variantKey(t, i, k) })).catch(() => {})));

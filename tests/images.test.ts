import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, ImageError, MAX_UPLOAD_BYTES } from "@/lib/images";
import { coverOf, readyPhotos } from "@/lib/image-urls";

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#c33" } }).png().toBuffer();

describe("processImage", () => {
  it("builds three WebP variants within size caps", async () => {
    const out = await processImage(await png(3000, 2000));
    for (const [k, w] of [["thumb", 320], ["medium", 800], ["large", 1600]] as const) {
      const m = await sharp(out.variants[k]).metadata();
      expect(m.format).toBe("webp"); expect(m.width).toBe(w);
    }
    expect(out.bytes).toBeGreaterThan(0);
  });
  it("does not upscale small images", async () => {
    const out = await processImage(await png(200, 100));
    expect((await sharp(out.variants.large).metadata()).width).toBe(200);
  });
  it("rejects non-images even with an image name/MIME", async () => {
    await expect(processImage(Buffer.from("<?php echo 1; ?>"))).rejects.toBeInstanceOf(ImageError);
  });
  it("rejects disallowed real formats (GIF)", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(processImage(gif)).rejects.toThrow(/JPEG, PNG or WebP/);
  });
  it("rejects files over the size cap", async () => {
    await expect(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toThrow(/8 MB/);
  });
  it("rejects decompression bombs (pixel cap)", async () => {
    const big = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(big.length).toBeLessThan(MAX_UPLOAD_BYTES);
    await expect(processImage(big)).rejects.toBeInstanceOf(ImageError);
  });
  it("strips EXIF metadata", async () => {
    const withExif = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#0a0" } })
      .jpeg().withMetadata({ exif: { IFD0: { Copyright: "secret", ImageDescription: "gps-ish" } } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processImage(withExif);
    for (const v of Object.values(out.variants)) expect((await sharp(v).metadata()).exif).toBeUndefined();
  });
});

describe("cover selection helpers", () => {
  const row = (id: string, o: number, cover = false, status = "ready") => ({ id, tenant_id: "t", is_cover: cover, sort_order: o, caption: null, status });
  it("prefers the flagged cover, ignores non-ready images", () => {
    expect(coverOf([row("a", 0), row("b", 1, true), row("c", 2, true, "pending")])!.id).toBe("b");
  });
  it("falls back to first ready by order", () => expect(coverOf([row("x", 3), row("y", 1)])!.id).toBe("y"));
  it("handles empty", () => { expect(coverOf([])).toBeNull(); expect(readyPhotos(null)).toEqual([]); });
});

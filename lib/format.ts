// Prices are stored in paise (price_minor). Display in Indian style.
export function formatPrice(minor: number | null | undefined): string {
  if (minor == null) return "Price on request";
  const rupees = minor / 100;
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)} Cr`;
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)} L`;
  return `₹${new Intl.NumberFormat("en-IN").format(rupees)}`;
}
const trim = (n: number) => String(Math.round(n * 100) / 100);
export const rupeesToMinor = (r: number) => Math.round(r * 100);

export function slugify(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "property";
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function publicId(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const buildSlug = (title: string, id: string) => `${slugify(title)}-${id}`;
// The trailing short id is the lookup key; the readable part can change freely.
export function idFromSlug(slug: string): string | null {
  const m = slug.match(/-([a-hj-km-np-z2-9]{6})$/);
  return m ? m[1] : null;
}

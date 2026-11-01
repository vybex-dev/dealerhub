import { describe, it, expect } from "vitest";
import { parseHost, validateSubdomain } from "@/lib/host";
import { formatPrice, slugify, buildSlug, idFromSlug, publicId } from "@/lib/format";

const R = "domain.com";
describe("parseHost", () => {
  it("root and www", () => { expect(parseHost("domain.com", R).kind).toBe("root"); expect(parseHost("www.domain.com", R).kind).toBe("root"); });
  it("tenant", () => expect(parseHost("kushalproperties.domain.com", R)).toEqual({ kind: "tenant", subdomain: "kushalproperties" }));
  it("case and trailing dot", () => expect(parseHost("Kushal.Domain.com.", R)).toEqual({ kind: "tenant", subdomain: "kushal" }));
  it("reserved", () => { for (const n of ["admin","api","app","support","billing","mail","dashboard"]) expect(parseHost(`${n}.domain.com`, R).kind).toBe("reserved"); });
  it("look-alike and foreign hosts", () => {
    expect(parseHost("evil-domain.com", R).kind).toBe("foreign");
    expect(parseHost("domain.com.evil.com", R).kind).toBe("foreign");
    expect(parseHost("a.b.domain.com", R).kind).toBe("foreign");
    expect(parseHost(null, R).kind).toBe("foreign");
  });
  it("invalid labels", () => { expect(parseHost("-bad-.domain.com", R).kind).toBe("foreign"); expect(parseHost("a.domain.com", R).kind).toBe("foreign"); });
  it("local dev with port", () => {
    expect(parseHost("localhost:3000", "localhost:3000").kind).toBe("root");
    expect(parseHost("kushal.localhost:3000", "localhost:3000")).toEqual({ kind: "tenant", subdomain: "kushal" });
  });
});
describe("validateSubdomain", () => {
  it("accepts good", () => expect(validateSubdomain("sharmahomes")).toBeNull());
  it("rejects reserved, short, bad chars", () => {
    expect(validateSubdomain("www")).not.toBeNull(); expect(validateSubdomain("ab")).not.toBeNull();
    expect(validateSubdomain("has space")).not.toBeNull(); expect(validateSubdomain("-x-y")).not.toBeNull();
  });
});
describe("format + slug", () => {
  it("formats Indian prices", () => { expect(formatPrice(14000000000)).toBe("₹14 Cr"); expect(formatPrice(8600000000 / 10)).toBe("₹86 L"); expect(formatPrice(null)).toBe("Price on request"); });
  it("slug keeps stable id key", () => {
    const id = publicId(); const s = buildSlug("3BHK Supertech Capetown!", id);
    expect(s).toBe(`3bhk-supertech-capetown-${id}`); expect(idFromSlug(s)).toBe(id);
    expect(idFromSlug(buildSlug("Renamed title", id))).toBe(id);
  });
  it("slugify edge", () => expect(slugify("  ***  ")).toBe("property"));
});

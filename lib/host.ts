// Hostname -> routing decision. Pure function so it can be unit tested.
export const RESERVED = new Set(["www","admin","api","app","support","billing","mail","dashboard","login","signup","static","assets","cdn","help","docs","status","blog"]);
export const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$/;

export type HostKind =
  | { kind: "root" }
  | { kind: "tenant"; subdomain: string }
  | { kind: "reserved"; name: string }
  | { kind: "foreign" };

export function parseHost(hostHeader: string | null, rootDomain: string): HostKind {
  if (!hostHeader) return { kind: "foreign" };
  const host = hostHeader.toLowerCase().replace(/\.$/, "");
  const root = rootDomain.toLowerCase();
  const hostNoPort = host.split(":")[0];
  const rootNoPort = root.split(":")[0];
  if (hostNoPort === rootNoPort) return { kind: "root" };
  if (!hostNoPort.endsWith("." + rootNoPort)) return { kind: "foreign" };
  const sub = hostNoPort.slice(0, -(rootNoPort.length + 1));
  if (sub === "www") return { kind: "root" };
  if (sub.includes(".")) return { kind: "foreign" }; // no nested subdomains
  if (RESERVED.has(sub)) return { kind: "reserved", name: sub };
  if (!SUBDOMAIN_RE.test(sub)) return { kind: "foreign" };
  return { kind: "tenant", subdomain: sub };
}

export function validateSubdomain(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(s)) return "Use 3-30 letters, numbers or hyphens. Start and end with a letter or number.";
  if (RESERVED.has(s)) return "That name is reserved. Choose another.";
  return null;
}

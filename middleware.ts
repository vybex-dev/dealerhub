import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/host";

export function middleware(req: NextRequest) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;
  const host = parseHost(req.headers.get("host"), root);
  const url = req.nextUrl.clone();

  // Internal tenant tree must never be reachable by direct path.
  if (url.pathname.startsWith("/sites")) return new NextResponse("Not found", { status: 404 });
  if (host.kind === "reserved" || host.kind === "foreign") return new NextResponse("Site not found", { status: 404 });

  // Always strip any client-supplied tenant header; only the hostname decides the tenant.
  const headers = new Headers(req.headers);
  headers.delete("x-tenant-subdomain");

  if (host.kind === "tenant") {
    headers.set("x-tenant-subdomain", host.subdomain);
    if (url.pathname.startsWith("/api/")) return NextResponse.next({ request: { headers } });
    url.pathname = `/sites/${host.subdomain}${url.pathname === "/" ? "" : url.pathname}`;
    const res = NextResponse.rewrite(url, { request: { headers } });
    if (req.nextUrl.pathname.startsWith("/dashboard")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

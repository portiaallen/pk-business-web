import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "pk_business_session";

export function proxy(request: NextRequest) {
  const incomingPath = request.nextUrl.pathname;
  const pathname = incomingPath === "/b2b" ? "/portal/dashboard" : incomingPath.replace(/^\/b2b(?=\/|$)/, "/portal");
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Browser mutations require same-origin requests. Stripe verifies its own signature.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      pathname !== "/api/stripe/webhook" && pathname !== "/api/ordinary-transfer/internal" && pathname !== "/api/setup/seed") {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
    }
  }

  // Portal routes require authentication
  if (pathname.startsWith("/portal")) {
    // Allow the login page itself
    if (pathname === "/portal/login") {
      return NextResponse.next();
    }
    if (!hasSession) {
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Admin routes require authentication (role check happens server-side in API)
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      const loginUrl = new URL("/portal/login?admin=1", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/portal/:path*",
    "/admin/:path*",
    "/b2b/:path*",
  ],
};

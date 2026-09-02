import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "pk_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

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
      const loginUrl = new URL("/portal/login", request.url);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/admin/:path*",
  ],
};

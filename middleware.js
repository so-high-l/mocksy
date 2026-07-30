import { NextResponse } from "next/server";
import { isAuthConfigured, SESSION_COOKIE, verifySessionToken } from "./lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/etsy/callback"]);

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!isAuthConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Set APP_PASSWORD and SESSION_SECRET before using Mocksy in production." },
        { status: 503 },
      );
    }
    const loginUrl = new URL("/login?configuration=missing", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (isAuthenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const returnTo = `${pathname}${search}`;
  if (returnTo !== "/") loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sample-artwork.svg).*)"],
};

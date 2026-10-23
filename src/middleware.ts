import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Skip auth in E2E test environments
  if (process.env.BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname === "/login";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isLocalLogin = req.nextUrl.pathname === "/api/local-login";
  const localLogin = process.env.LOCAL_LOGIN === "true";

  // Allow unauthenticated access to auth pages and auth API routes
  if (isApiAuth || isAuthPage || isLocalLogin) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login — lokalt direkte til auto-login
  if (!isLoggedIn) {
    const loginUrl = new URL(localLogin ? "/api/local-login" : "/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

// Match all routes except Next.js internals and static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.svg|.*\.png).*)"],
};

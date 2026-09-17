import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_PRESENCE_COOKIE } from "@/store/auth.store";

/**
 * Auth gate — Next.js 16's `proxy.ts` (renamed from `middleware.ts`).
 * Optimistic presence-cookie check before route render; server remains authoritative.
 * `fo_auth=1` is NOT a JWT and is not a credential — only a UX gate.
 */

const PROTECTED_PREFIXES: string[] = ["/profile", "/checkout", "/vault", "/visa", "/rewards", "/groups", "/mice"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasAuthPresence(request: NextRequest): boolean {
  const modern = request.cookies.get(AUTH_PRESENCE_COOKIE)?.value;
  if (modern === "1") return true;
  // Legacy: old builds stored the access JWT in fo_access — treat non-empty as presence only.
  const legacy = request.cookies.get("fo_access")?.value;
  return Boolean(legacy && legacy !== "1" ? legacy.length > 20 : legacy === "1");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasAuthPresence(request);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/signup" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

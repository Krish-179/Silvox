import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sv_session";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (hasSession) {
    // Presence-only check — not full JWT verification. An expired or
    // tampered cookie still redirects here, but /dashboard's own
    // api.me() check (via ProjectContext) catches that and bounces back
    // to /login, so this is a fast-path optimization, not the actual
    // security boundary. Real enforcement stays server-side in Fastify's
    // requireSession middleware, same as always.
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/", // only run this check on the landing page itself
};

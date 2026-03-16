import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
 
/**
 * Auth middleware:
 *
 * - Unauthenticated user hits ANY protected path → redirect to /login
 * - Authenticated user hits an unknown/404 path  → Next.js serves not-found.tsx
 *
 * Public paths (no auth needed):
 *   /login, /register, /forgot-password, /api/auth/**
 *
 * Everything else is protected. If unauthenticated, next-auth/middleware
 * redirects to the signIn page defined in authOptions.pages.signIn (/login).
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});
 
export const config = {
  matcher: [
    /*
     * Match ALL paths EXCEPT:
     *   - /login, /register, /forgot-password  (public auth pages)
     *   - /api/auth/**                          (NextAuth endpoints)
     *   - /_next/**                             (Next.js internals)
     *   - /favicon.ico, /robots.txt, etc.       (static files)
     */
    "/((?!login|register|forgot-password|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)",
  ],
};
 







// middleware.ts

export { default } from "next-auth/middleware";

/**
 * LOOP PREVENTION:
 * Only protect dashboard paths. /login and /api/auth/** are NEVER in this
 * matcher — they stay public. This is the key to avoiding /login→/→/login.
 */
export const config = {
  matcher: [
    "/",
    "/customers/:path*",
    "/orders/:path*",
    "/delivery/:path*",
    "/warehouse/:path*",
    "/gasback/:path*",
    "/reports/:path*",
    "/recon/:path*",
    "/users/:path*",
    "/settings/:path*",
  ],
};
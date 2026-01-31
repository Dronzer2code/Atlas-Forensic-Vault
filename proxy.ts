import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy() {
    // Add custom proxy logic here if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/login",
          "/api/auth",
          "/api/health",
          "/api/stats",
          "/api/podcasts",
        ];

        // Check if route is public
        const isPublicRoute = publicRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );

        // Allow public routes
        if (isPublicRoute) {
          return true;
        }

        // API routes should handle their own auth and return 401
        // Don't redirect API routes - let them handle auth themselves
        if (pathname.startsWith("/api/")) {
          return true;
        }

        // Require authentication for protected page routes only
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};

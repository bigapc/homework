import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_ROUTES = [
  "/request",
  "/safety-plan",
  "/courier",
  "/dashboard",
  "/admin",
  "/track",
  "/payments",
  "/legal-docs",
  "/incident-log",
]

function getRequiredRole(pathname: string): "survivor" | "courier" | "admin" | null {
  if (pathname.startsWith("/dashboard")) {
    return null
  }

  if (pathname.startsWith("/request")) {
    return "survivor"
  }

  if (pathname.startsWith("/safety-plan/share")) {
    return null
  }

  if (pathname.startsWith("/courier/onboard")) {
    return null
  }

  if (pathname.startsWith("/safety-plan")) {
    return "survivor"
  }

  if (pathname.startsWith("/track")) {
    return "survivor"
  }

  if (pathname.startsWith("/payments")) {
    return "survivor"
  }

  if (pathname.startsWith("/legal-docs")) {
    return "survivor"
  }

  if (pathname.startsWith("/incident-log")) {
    return "survivor"
  }

  if (pathname.startsWith("/courier")) {
    return "courier"
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) {
    return "admin"
  }

  return null
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const isProtected =
    PROTECTED_ROUTES.some((path) => req.nextUrl.pathname.startsWith(path)) &&
    !req.nextUrl.pathname.startsWith("/safety-plan/share") &&
    !req.nextUrl.pathname.startsWith("/courier/onboard")

  // If Supabase isn't configured (e.g. during smoke checks), treat every
  // protected route as unauthenticated and redirect to /login.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isProtected) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = "/login"
      return NextResponse.redirect(loginUrl)
    }
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (isProtected && !session) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  if (session) {
    const requiredRole = getRequiredRole(req.nextUrl.pathname)

    if (requiredRole) {
      const { data: userRow, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single()

      if (error || userRow?.role !== requiredRole) {
        const deniedUrl = req.nextUrl.clone()
        deniedUrl.pathname = "/access-denied"
        deniedUrl.searchParams.set("from", req.nextUrl.pathname)
        deniedUrl.searchParams.set("required", requiredRole)
        return NextResponse.redirect(deniedUrl)
      }
    }
  }

  return res
}

export const config = {
  matcher: [
    "/request/:path*",
    "/safety-plan/:path*",
    "/courier/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/track/:path*",
    "/payments/:path*",
    "/legal-docs/:path*",
    "/incident-log/:path*",
  ],
}

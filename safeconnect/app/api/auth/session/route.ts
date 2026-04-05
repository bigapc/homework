import { NextResponse } from "next/server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

export const runtime = "nodejs"

type UserRole = "survivor" | "courier" | "admin" | null

export async function GET(request: Request) {
  const routeSupabase = getServerRouteSupabase()

  if (!routeSupabase) {
    return NextResponse.json({ error: "Server auth client unavailable." }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  const {
    data: { user },
    error: authError,
  } = bearerToken
    ? await routeSupabase.auth.getUser(bearerToken)
    : await routeSupabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ user: null, role: null as UserRole })
  }

  const adminSupabase = getServerAdminSupabase()

  if (!adminSupabase) {
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      role: null as UserRole,
    })
  }

  const { data: roleRow } = await adminSupabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    role: (roleRow?.role ?? null) as UserRole,
  })
}
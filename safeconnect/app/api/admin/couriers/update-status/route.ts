import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"
import {
  getApplicationReviewTimestamps,
  isReviewableCourierStatus,
} from "@/lib/courierApplicationWorkflow"

async function requireAdmin() {
  const supabase = getServerRouteSupabase()

  if (!supabase) {
    return { supabase: null, userId: null, error: "Supabase route client unavailable.", status: 503 }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, userId: null, error: "Unauthorized", status: 401 }
  }

  const { data: roleRow } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (roleRow?.role !== "admin") {
    return { supabase, userId: user.id, error: "Admin access required.", status: 403 }
  }

  return { supabase, userId: user.id, error: null as string | null, status: 200 }
}

export async function POST(req: Request) {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string }

  if (!body.id || !body.status || !isReviewableCourierStatus(body.status)) {
    return NextResponse.json({ error: "Missing or invalid id/status." }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const { reviewedAt, approvedAt } = getApplicationReviewTimestamps(body.status, nowIso)

  const { error } = await auth.supabase
    .from("courier_applications")
    .update({
      status: body.status,
      reviewed_at: reviewedAt,
      approved_at: approvedAt,
    })
    .eq("id", body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

import { NextResponse } from "next/server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"
import {
  getApplicationReviewTimestamps,
  getPromotionLookupStrategy,
  isReviewableCourierStatus,
  type ReviewableCourierStatus,
} from "@/lib/courierApplicationWorkflow"

export const runtime = "nodejs"

type UpdateCourierApplicationBody = {
  status?: ReviewableCourierStatus
}

type ApplicationLookupRow = {
  id: string
  email: string
  status: ReviewableCourierStatus
  user_id: string | null
}

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

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const applicationId = context.params.id

  if (!applicationId) {
    return NextResponse.json({ error: "Application id is required." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as UpdateCourierApplicationBody
  const nextStatus = body.status

  if (!nextStatus || !isReviewableCourierStatus(nextStatus)) {
    return NextResponse.json({ error: "Invalid courier application status." }, { status: 400 })
  }

  const { data: existingApplication, error: existingError } = await auth.supabase
    .from("courier_applications")
    .select("id,email,status,user_id")
    .eq("id", applicationId)
    .single<ApplicationLookupRow>()

  if (existingError || !existingApplication) {
    return NextResponse.json({ error: "Courier application not found." }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const { reviewedAt, approvedAt } = getApplicationReviewTimestamps(nextStatus, nowIso)

  const { data: updatedApplication, error: updateError } = await auth.supabase
    .from("courier_applications")
    .update({ status: nextStatus, reviewed_at: reviewedAt, approved_at: approvedAt })
    .eq("id", applicationId)
    .select("id,email,status,reviewed_at,approved_at")
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  let promotedUserId: string | null = null
  let promotionLookup: "user_id" | "email" | "none" = "none"

  if (nextStatus === "approved") {
    const adminSupabase = getServerAdminSupabase()

    if (adminSupabase) {
      let matchedUser: { id: string; role: string } | null = null
      let userLookupError: { message: string } | null = null
      promotionLookup = getPromotionLookupStrategy(existingApplication.user_id)

      if (promotionLookup === "user_id") {
        const { data, error } = await adminSupabase
          .from("users")
          .select("id,role")
          .eq("id", existingApplication.user_id)
          .maybeSingle()

        matchedUser = data
        userLookupError = error
      } else {
        const { data, error } = await adminSupabase
          .from("users")
          .select("id,role")
          .ilike("email", existingApplication.email)
          .maybeSingle()

        matchedUser = data
        userLookupError = error
      }

      if (!userLookupError && matchedUser && matchedUser.role !== "admin") {
        const { data: promotedUser, error: promoteError } = await adminSupabase
          .from("users")
          .update({ role: "courier" })
          .eq("id", matchedUser.id)
          .select("id")
          .single()

        if (!promoteError) {
          promotedUserId = promotedUser.id
        }
      }
    }
  }

  await auth.supabase.from("compliance_audit_logs").insert({
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "courier_application_status_updated",
    resource_type: "courier_application",
    resource_id: updatedApplication.id,
    metadata: {
      previousStatus: existingApplication.status,
      nextStatus,
      applicationEmail: existingApplication.email,
      applicationUserId: existingApplication.user_id,
      promotedUserId,
      promotionLookup,
    },
  })

  return NextResponse.json({
    application: updatedApplication,
    promotedUserId,
  })
}

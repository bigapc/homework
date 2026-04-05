import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

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

  const adminClient = getServerAdminSupabase()
  if (!adminClient) {
    return NextResponse.json({ error: "Admin client unavailable." }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { applicationId?: string }

  if (!body.applicationId) {
    return NextResponse.json({ error: "Missing applicationId." }, { status: 400 })
  }

  const { data: application, error: appError } = await adminClient
    .from("courier_applications")
    .select("id,user_id,first_name,last_name,email,phone,vehicle,vehicle_type,service_radius_miles,willing_to_commute_miles,latitude,longitude")
    .eq("id", body.applicationId)
    .single()

  if (appError || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 })
  }

  const linkedUserId = application.user_id || null

  if (!linkedUserId) {
    return NextResponse.json(
      { error: "This applicant is not linked to an authenticated user yet." },
      { status: 400 }
    )
  }

  const { error: roleError } = await adminClient
    .from("users")
    .update({ role: "courier" })
    .eq("id", linkedUserId)

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  const { error: courierError } = await adminClient.from("couriers").upsert(
    {
      user_id: linkedUserId,
      application_id: application.id,
      first_name: application.first_name,
      last_name: application.last_name,
      phone: application.phone,
      vehicle_type: application.vehicle_type || "car",
      vehicle_description: application.vehicle || null,
      latitude: application.latitude,
      longitude: application.longitude,
      service_radius_miles: application.service_radius_miles || 25,
      willing_to_commute_miles: application.willing_to_commute_miles || 50,
      status: "offline",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (courierError) {
    return NextResponse.json({ error: courierError.message }, { status: 500 })
  }

  const { error: onboardingError } = await adminClient.from("courier_onboarding").upsert(
    {
      courier_id: linkedUserId,
      identity_verified: true,
      background_check_passed: true,
      training_completed: false,
      agreement_signed: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: "courier_id" }
  )

  if (onboardingError) {
    return NextResponse.json({ error: onboardingError.message }, { status: 500 })
  }

  const { error: updateError } = await adminClient
    .from("courier_applications")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", body.applicationId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

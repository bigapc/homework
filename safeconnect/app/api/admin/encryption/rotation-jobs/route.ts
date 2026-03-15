import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

export const runtime = "nodejs"

type RotationCreateBody = {
  targetTable?: "exchanges" | "incident_reports" | "safety_entries" | "safety_plans"
  fromVersion?: number
  toVersion?: number
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

export async function GET() {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from("encryption_rotation_jobs")
    .select("id,requested_by,from_version,to_version,target_table,status,total_count,processed_count,manual_required_count,last_error,created_at,updated_at,completed_at")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as RotationCreateBody

  const targetTable = body.targetTable
  const fromVersion = Number(body.fromVersion)
  const toVersion = Number(body.toVersion)

  if (!targetTable || !Number.isFinite(fromVersion) || !Number.isFinite(toVersion) || fromVersion < 1 || toVersion < 1 || fromVersion === toVersion) {
    return NextResponse.json({ error: "Invalid rotation job payload." }, { status: 400 })
  }

  const { count } = await auth.supabase
    .from(targetTable)
    .select("id", { count: "exact", head: true })
    .eq("encryption_key_version", fromVersion)

  const { data, error } = await auth.supabase
    .from("encryption_rotation_jobs")
    .insert({
      requested_by: auth.userId,
      from_version: fromVersion,
      to_version: toVersion,
      target_table: targetTable,
      status: "planned",
      total_count: count ?? 0,
    })
    .select("id,from_version,to_version,target_table,status,total_count,processed_count,manual_required_count,created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await auth.supabase.from("compliance_audit_logs").insert({
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "encryption_rotation_job_created",
    resource_type: "encryption_rotation_job",
    resource_id: data.id,
    metadata: {
      targetTable,
      fromVersion,
      toVersion,
      totalCount: count ?? 0,
    },
  })

  return NextResponse.json({ job: data })
}

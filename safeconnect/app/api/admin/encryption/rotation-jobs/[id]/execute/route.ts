import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

export const runtime = "nodejs"

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

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const jobId = context.params.id

  const { data: job, error: jobError } = await auth.supabase
    .from("encryption_rotation_jobs")
    .select("id,from_version,to_version,target_table,status")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: "Rotation job not found." }, { status: 404 })
  }

  await auth.supabase
    .from("encryption_rotation_jobs")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", jobId)

  const fromVersion = Number(job.from_version)
  const toVersion = Number(job.to_version)

  let processedCount = 0
  let manualRequiredCount = 0
  let status: "completed" | "manual_required" | "failed" = "completed"
  let lastError: string | null = null

  try {
    if (job.target_table === "exchanges") {
      const { data: exchangeRows, error: rowError } = await auth.supabase
        .from("exchanges")
        .select("id,items_encrypted")
        .eq("encryption_key_version", fromVersion)

      if (rowError) {
        throw new Error(rowError.message)
      }

      const rows = exchangeRows ?? []
      const autoIds = rows.filter((row) => !row.items_encrypted).map((row) => row.id)
      manualRequiredCount = rows.length - autoIds.length

      if (autoIds.length > 0) {
        const { error: updateError } = await auth.supabase
          .from("exchanges")
          .update({ encryption_key_version: toVersion })
          .in("id", autoIds)

        if (updateError) {
          throw new Error(updateError.message)
        }
      }

      processedCount = autoIds.length
      status = manualRequiredCount > 0 ? "manual_required" : "completed"
    } else {
      const { count, error: countError } = await auth.supabase
        .from(job.target_table)
        .select("id", { count: "exact", head: true })
        .eq("encryption_key_version", fromVersion)

      if (countError) {
        throw new Error(countError.message)
      }

      manualRequiredCount = count ?? 0
      processedCount = 0
      status = manualRequiredCount > 0 ? "manual_required" : "completed"
    }
  } catch (error) {
    status = "failed"
    lastError = error instanceof Error ? error.message : "Unknown rotation error"
  }

  const completedAt = status === "completed" ? new Date().toISOString() : null

  await auth.supabase
    .from("encryption_rotation_jobs")
    .update({
      status,
      processed_count: processedCount,
      manual_required_count: manualRequiredCount,
      last_error: lastError,
      updated_at: new Date().toISOString(),
      completed_at: completedAt,
    })
    .eq("id", jobId)

  await auth.supabase.from("compliance_audit_logs").insert({
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "encryption_rotation_job_executed",
    resource_type: "encryption_rotation_job",
    resource_id: jobId,
    metadata: {
      targetTable: job.target_table,
      fromVersion,
      toVersion,
      processedCount,
      manualRequiredCount,
      status,
      lastError,
    },
  })

  return NextResponse.json({
    jobId,
    status,
    processedCount,
    manualRequiredCount,
    lastError,
  })
}

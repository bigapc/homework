import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

export const runtime = "nodejs"

type KeyCreateBody = {
  notes?: string
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
    .from("encryption_key_registry")
    .select("id,key_version,algorithm,scope,status,activated_at,retired_at,notes,created_at")
    .order("key_version", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as KeyCreateBody

  const { data: latestKey } = await auth.supabase
    .from("encryption_key_registry")
    .select("key_version")
    .order("key_version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (latestKey?.key_version ?? 0) + 1

  await auth.supabase
    .from("encryption_key_registry")
    .update({ status: "deprecated", retired_at: new Date().toISOString() })
    .eq("status", "active")

  const { data, error } = await auth.supabase
    .from("encryption_key_registry")
    .insert({
      key_version: nextVersion,
      status: "active",
      notes: body.notes ?? null,
      created_by: auth.userId,
      activated_at: new Date().toISOString(),
    })
    .select("id,key_version,status,notes")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await auth.supabase.from("compliance_audit_logs").insert({
    actor_user_id: auth.userId,
    actor_role: "admin",
    action: "encryption_key_rotated",
    resource_type: "encryption_key_registry",
    resource_id: String(data.key_version),
    metadata: {
      keyVersion: data.key_version,
      notes: body.notes ?? null,
    },
  })

  return NextResponse.json({ key: data })
}

import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

export const runtime = "nodejs"

type AuditBody = {
  action?: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  const supabase = getServerRouteSupabase()

  if (!supabase) {
    return NextResponse.json({ error: "Supabase route client unavailable." }, { status: 503 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  const body = (await request.json().catch(() => ({}))) as AuditBody

  if (!body.action || !body.resourceType) {
    return NextResponse.json({ error: "action and resourceType are required." }, { status: 400 })
  }

  const { error } = await supabase.from("compliance_audit_logs").insert({
    actor_user_id: user.id,
    actor_role: roleRow?.role ?? null,
    action: body.action,
    resource_type: body.resourceType,
    resource_id: body.resourceId ?? null,
    metadata: body.metadata ?? {},
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

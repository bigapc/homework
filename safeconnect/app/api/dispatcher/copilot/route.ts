import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

type ExchangePayload = {
  id: string
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  vehicle_type: "standard" | "premium" | "xl"
  service_window_mode: "asap" | "scheduled" | null
  requested_service_at: string | null
  quoted_distance_miles: number | null
  quoted_duration_minutes: number | null
  quoted_total_cents: number | null
  quoted_is_after_hours: boolean
  quoted_is_weekend: boolean
  quoted_is_high_risk: boolean
}

type NearbyCourierPayload = {
  user_id: string
  first_name: string
  last_name: string
  vehicle_type: string
  rating: number | null
  total_deliveries: number
  distance_miles: number
  status: string
}

async function getAuth(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const authHeader = req.headers.get("authorization")
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  const {
    data: { user },
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  const adminSupabase = getServerAdminSupabase()
  return {
    supabase: bearerToken && adminSupabase ? adminSupabase : supabase,
    user,
  }
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuth(req)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openAiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing on server." },
      { status: 503 }
    )
  }

  const body = (await req.json()) as {
    exchange?: ExchangePayload
    nearbyCouriers?: NearbyCourierPayload[]
  }

  const exchange = body.exchange
  const nearbyCouriers = body.nearbyCouriers ?? []

  if (!exchange || !exchange.id || !exchange.pickup || !exchange.dropoff) {
    return NextResponse.json({ error: "Invalid exchange payload." }, { status: 400 })
  }

  if (!Array.isArray(nearbyCouriers) || nearbyCouriers.length === 0) {
    return NextResponse.json({ error: "At least one nearby courier is required." }, { status: 400 })
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"

  const prompt = {
    exchange,
    nearbyCouriers,
    instruction:
      "Recommend one courier for this exchange. Respond strictly as JSON with keys: summary, reasoning, recommended_user_id, sms_draft. summary and reasoning should be concise and operationally useful. recommended_user_id must match one courier user_id from nearbyCouriers. sms_draft should be short and ready to send.",
  }

  const completionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a dispatch copilot for a safety-focused courier platform. Output valid JSON only with no markdown.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
    }),
  })

  const completionPayload = (await completionRes.json().catch(() => ({}))) as {
    error?: { message?: string }
    choices?: Array<{
      message?: { content?: string }
    }>
  }

  if (!completionRes.ok) {
    return NextResponse.json(
      { error: completionPayload.error?.message || "LLM request failed." },
      { status: 502 }
    )
  }

  const content = completionPayload.choices?.[0]?.message?.content?.trim() || ""

  let parsed: {
    summary?: string
    reasoning?: string
    recommended_user_id?: string | null
    sms_draft?: string
  }

  try {
    parsed = JSON.parse(content)
  } catch {
    return NextResponse.json({ error: "LLM response was not valid JSON." }, { status: 502 })
  }

  const recommendedUserId = parsed.recommended_user_id ?? null
  const validRecommendation =
    !recommendedUserId || nearbyCouriers.some((courier) => courier.user_id === recommendedUserId)

  if (!validRecommendation) {
    return NextResponse.json(
      { error: "LLM returned an invalid courier recommendation." },
      { status: 502 }
    )
  }

  return NextResponse.json({
    suggestion: {
      summary: parsed.summary || "AI summary unavailable.",
      reasoning: parsed.reasoning || "AI reasoning unavailable.",
      recommended_user_id: recommendedUserId,
      sms_draft: parsed.sms_draft || "Dispatch alert draft unavailable.",
    },
  })
}

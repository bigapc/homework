import { NextResponse } from "next/server"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

export const runtime = "nodejs"

type CourierAction = "accept" | "picked_up" | "start_tracking" | "delivered"

const ACTION_TO_STATUS: Record<CourierAction, string> = {
  accept: "assigned",
  picked_up: "picked_up",
  start_tracking: "in_transit",
  delivered: "completed",
}

const REQUIRED_COMPLETION_PROOFS = [
  "pickup_photo",
  "pickup_signature",
  "dropoff_photo",
  "dropoff_signature",
]

async function requireCourier() {
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

  if (roleRow?.role !== "courier") {
    return { supabase, userId: user.id, error: "Courier access required.", status: 403 }
  }

  return { supabase, userId: user.id, error: null as string | null, status: 200 }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireCourier()

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const exchangeId = context.params.id

  if (!exchangeId) {
    return NextResponse.json({ error: "Assignment id is required." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: CourierAction
    latitude?: number
    longitude?: number
  }

  if (!body.action || !(body.action in ACTION_TO_STATUS)) {
    return NextResponse.json({ error: "Invalid courier action." }, { status: 400 })
  }

  const { data: exchange, error: exchangeError } = await auth.supabase
    .from("exchanges")
    .select("id,courier_id,status,pickup,dropoff,payment_status,payment_required")
    .eq("id", exchangeId)
    .eq("courier_id", auth.userId)
    .single()

  if (exchangeError || !exchange) {
    return NextResponse.json({ error: "Assignment not found for this courier." }, { status: 404 })
  }

  if ((body.action === "accept" || body.action === "picked_up" || body.action === "start_tracking" || body.action === "delivered") && exchange.payment_required && exchange.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Client payment must be confirmed before courier workflow can continue." },
      { status: 409 }
    )
  }

  if (body.action === "delivered") {
    const { data: proofRows, error: proofError } = await auth.supabase
      .from("exchange_service_proofs")
      .select("proof_type")
      .eq("exchange_id", exchangeId)
      .eq("courier_id", auth.userId)
      .in("proof_type", REQUIRED_COMPLETION_PROOFS)

    if (proofError) {
      return NextResponse.json({ error: proofError.message }, { status: 500 })
    }

    const completedTypes = new Set((proofRows ?? []).map((row) => row.proof_type))
    const missingProofs = REQUIRED_COMPLETION_PROOFS.filter((proofType) => !completedTypes.has(proofType))

    if (missingProofs.length > 0) {
      return NextResponse.json(
        { error: `Proof package incomplete. Missing: ${missingProofs.join(", ")}.` },
        { status: 409 }
      )
    }
  }

  const nextStatus = ACTION_TO_STATUS[body.action]

  const { error: updateError } = await auth.supabase
    .from("exchanges")
    .update({ status: nextStatus })
    .eq("id", exchangeId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if ((body.action === "start_tracking" || body.action === "delivered") && typeof body.latitude === "number" && typeof body.longitude === "number") {
    const trackingStatus = body.action === "delivered" ? "delivered" : "enroute"
    const { error: trackingError } = await auth.supabase.from("tracking").insert({
      request_id: exchangeId,
      courier_id: auth.userId,
      route_lat: body.latitude,
      route_lng: body.longitude,
      status: trackingStatus,
    })

    if (trackingError) {
      return NextResponse.json({ error: trackingError.message }, { status: 500 })
    }
  }

  const adminSupabase = getServerAdminSupabase()

  if (adminSupabase) {
    const contractStatus =
      body.action === "accept"
        ? "accepted"
        : body.action === "delivered"
          ? "completed"
          : "in_transit"

    const { data: existingContract } = await adminSupabase
      .from("exchange_courier_contracts")
      .select("id")
      .eq("exchange_id", exchangeId)
      .eq("courier_id", auth.userId)
      .maybeSingle()

    if (existingContract?.id) {
      await adminSupabase
        .from("exchange_courier_contracts")
        .update({
          status: contractStatus,
          pickup_location: exchange.pickup,
          dropoff_location: exchange.dropoff,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingContract.id)
    } else {
      await adminSupabase.from("exchange_courier_contracts").insert({
        exchange_id: exchangeId,
        courier_id: auth.userId,
        role: "primary",
        status: contractStatus,
        pickup_location: exchange.pickup,
        dropoff_location: exchange.dropoff,
      })
    }

    await adminSupabase.from("dispatch_events").insert({
      exchange_id: exchangeId,
      admin_id: auth.userId,
      courier_id: auth.userId,
      event_type: "note",
      note: `Courier action: ${body.action}`,
    })

    if (body.action === "delivered") {
      const { data: courierRow } = await adminSupabase
        .from("couriers")
        .select("total_deliveries")
        .eq("user_id", auth.userId)
        .maybeSingle()

      await adminSupabase
        .from("couriers")
        .update({
          status: "offline",
          total_deliveries: (courierRow?.total_deliveries ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.userId)
    }
  }

  return NextResponse.json({ success: true, status: nextStatus })
}

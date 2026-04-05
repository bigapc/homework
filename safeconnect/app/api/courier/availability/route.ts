import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, user }
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuth(req)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { action, latitude, longitude, accuracy_meters } = body

  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 })
  }

  // Check if user is a courier
  const { data: courier, error: courierError } = await supabase
    .from("couriers")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (courierError || !courier) {
    return NextResponse.json(
      { error: "User is not an approved courier" },
      { status: 403 }
    )
  }

  if (action === "online") {
    // Set courier to online
    const { error: updateError } = await supabase
      .from("couriers")
      .update({
        status: "online",
        last_online_at: new Date().toISOString(),
      })
      .eq("id", courier.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: "Courier is now online" })
  }

  if (action === "offline") {
    // Set courier to offline
    const { error: updateError } = await supabase
      .from("couriers")
      .update({
        status: "offline",
        last_offline_at: new Date().toISOString(),
      })
      .eq("id", courier.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: "Courier is now offline" })
  }

  if (action === "location") {
    // Update courier location
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { error: "latitude and longitude are required" },
        { status: 400 }
      )
    }

    // Update courier current location
    const { error: updateError } = await supabase
      .from("couriers")
      .update({
        latitude,
        longitude,
        last_location_update_at: new Date().toISOString(),
      })
      .eq("id", courier.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Record location in history
    const { error: historyError } = await supabase
      .from("courier_locations")
      .insert({
        courier_id: courier.id,
        latitude,
        longitude,
        accuracy_meters,
      })

    if (historyError) {
      console.error("Failed to record location history:", historyError)
      // Don't fail the request if history recording fails
    }

    return NextResponse.json({
      status: "Location updated",
      latitude,
      longitude,
    })
  }

  return NextResponse.json(
    { error: "Invalid action" },
    { status: 400 }
  )
}

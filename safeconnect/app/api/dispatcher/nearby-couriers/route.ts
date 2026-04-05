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

  // Check if user is admin/dispatcher
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { pickup_lat, pickup_lng, vehicle_type = null, max_distance_miles = 25 } = body

  if (typeof pickup_lat !== "number" || typeof pickup_lng !== "number") {
    return NextResponse.json(
      { error: "pickup_lat and pickup_lng are required" },
      { status: 400 }
    )
  }

  // Call the find_nearby_couriers function
  const { data: nearestCouriers, error } = await supabase.rpc(
    "find_nearby_couriers",
    {
      pickup_lat,
      pickup_lng,
      vehicle_type,
      max_distance_miles,
    }
  )

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    pickup: { lat: pickup_lat, lng: pickup_lng },
    vehicle_filter: vehicle_type,
    max_distance: max_distance_miles,
    couriers: nearestCouriers || [],
    count: (nearestCouriers || []).length,
  })
}

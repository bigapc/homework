"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { exchangeQuoteSelectFields, isMissingExchangeQuoteColumnsError } from "@/lib/exchangeQuote"

type Courier = {
  id: string
  email: string
}

type NearbyCourier = {
  courier_id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  vehicle_type: string
  rating: number | null
  total_deliveries: number
  distance_miles: number
  status: string
}

type Exchange = {
  id: string
  user_id: string
  courier_id: string | null
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
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

type DispatchEvent = {
  id: string
  exchange_id: string
  event_type: "assigned" | "reassigned" | "status_changed" | "note"
  note: string | null
  created_at: string
}

type DispatcherBaseProps = {
  title?: string
  productName?: string
  subtitle?: string
}

export default function DispatcherBase({
  title = "SafeConnect Dispatcher Base",
  productName = "Powered by Armstrong Pack Company",
  subtitle = "Secure dispatch command center for staff and courier coordination.",
}: DispatcherBaseProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [events, setEvents] = useState<DispatchEvent[]>([])
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({})
  const [nearbyCouriers, setNearbyCouriers] = useState<Record<string, NearbyCourier[]>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState("")
  const [lookupId, setLookupId] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const mapVehicleType = (vehicleType: Exchange["vehicle_type"]) => {
    if (vehicleType === "xl") {
      return "van"
    }

    return "car"
  }

  const geocodeAddress = async (address: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    if (!token) {
      throw new Error("Mapbox token is not configured.")
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${token}`
    )

    const payload = (await response.json()) as {
      features?: Array<{ center?: [number, number] }>
    }

    const center = payload.features?.[0]?.center

    if (!center) {
      throw new Error("Unable to geocode pickup address.")
    }

    return { lng: center[0], lat: center[1] }
  }

  const findNearby = async (exchange: Exchange) => {
    setLookupId(exchange.id)
    setError("")
    setMessage("")

    try {
      const coords = await geocodeAddress(exchange.pickup)
      const response = await fetch("/api/dispatcher/nearby-couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: coords.lat,
          pickup_lng: coords.lng,
          vehicle_type: mapVehicleType(exchange.vehicle_type),
          max_distance_miles: 50,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        couriers?: NearbyCourier[]
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch nearby couriers.")
      }

      const matches = payload.couriers ?? []
      setNearbyCouriers((prev) => ({ ...prev, [exchange.id]: matches }))

      if (matches[0]) {
        setSelectedCourier((prev) => ({ ...prev, [exchange.id]: matches[0].user_id }))
      }

      setMessage(matches.length ? `Found ${matches.length} nearby courier matches.` : "No nearby couriers found.")
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Unable to look up nearby couriers.")
    } finally {
      setLookupId("")
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [courierRes, exchangeRes, eventRes] = await Promise.all([
      supabase.from("users").select("id,email").eq("role", "courier").order("email", { ascending: true }),
      supabase
        .from("exchanges")
        .select(`id,user_id,courier_id,pickup,dropoff,status,created_at,vehicle_type,${exchangeQuoteSelectFields}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("dispatch_events")
        .select("id,exchange_id,event_type,note,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    let safeExchangeData: unknown = exchangeRes.data
    let safeExchangeError = exchangeRes.error

    if (safeExchangeError && isMissingExchangeQuoteColumnsError(safeExchangeError.message)) {
      const fallbackExchangeRes = await supabase
        .from("exchanges")
        .select("id,user_id,courier_id,pickup,dropoff,status,created_at,vehicle_type")
        .order("created_at", { ascending: false })
        .limit(50)

      safeExchangeData = fallbackExchangeRes.data
      safeExchangeError = fallbackExchangeRes.error
    }

    if (courierRes.error || safeExchangeError || eventRes.error) {
      setError(courierRes.error?.message || safeExchangeError?.message || eventRes.error?.message || "Unable to load dispatch data.")
      setLoading(false)
      return
    }

    setCouriers((courierRes.data ?? []) as Courier[])
    setExchanges(((safeExchangeData ?? []) as unknown[]) as Exchange[])
    setEvents((eventRes.data ?? []) as DispatchEvent[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const assignCourier = async (exchange: Exchange) => {
    const courierId = selectedCourier[exchange.id]

    if (!courierId) {
      setError("Choose a courier first.")
      return
    }

    setWorkingId(exchange.id)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({
        courier_id: courierId,
        status: "assigned",
      })
      .eq("id", exchange.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingId("")
      return
    }

    if (adminId) {
      await supabase.from("dispatch_events").insert({
        exchange_id: exchange.id,
        admin_id: adminId,
        courier_id: courierId,
        event_type: exchange.courier_id ? "reassigned" : "assigned",
        note: exchange.courier_id ? "Courier reassigned by dispatch base." : "Courier assigned by dispatch base.",
      })
    }

    if (courierId) {
      await supabase.from("notification_events").insert({
        user_id: courierId,
        exchange_id: exchange.id,
        channel: "sms",
        recipient: "pending-courier-number",
        template: "courier_assignment",
        payload: {
          exchangeId: exchange.id,
          pickup: exchange.pickup,
          dropoff: exchange.dropoff,
        },
      })
    }

    setMessage("Dispatch updated successfully.")
    setWorkingId("")
    await loadData()
  }

  const updateStatus = async (exchange: Exchange, nextStatus: Exchange["status"]) => {
    setWorkingId(exchange.id)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({ status: nextStatus })
      .eq("id", exchange.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingId("")
      return
    }

    if (adminId) {
      await supabase.from("dispatch_events").insert({
        exchange_id: exchange.id,
        admin_id: adminId,
        courier_id: exchange.courier_id,
        event_type: "status_changed",
        note: `Status changed to ${nextStatus}.`,
      })
    }

    setMessage("Exchange status updated.")
    setWorkingId("")
    await loadData()
  }

  return (
    <div className="section-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">{productName}</p>
        <h1 className="text-3xl font-bold text-safe-900">{title}</h1>
        <p className="text-safe-500 text-sm mt-1">{subtitle}</p>
      </div>

      <div className="rounded-3xl border border-safe-200/80 bg-gradient-to-r from-safe-950 via-safe-900 to-safe-800 px-5 py-4 text-white shadow-lg shadow-safe-950/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-safe-300">Top-line Security</p>
            <p className="text-sm text-safe-100 max-w-2xl">
              Admin-only access with role-based authentication, audit-ready dispatch logging, and secure courier assignment workflow.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-safe-100/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-safe-100">
            Security first • Staff & customer safety</span>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {loading ? (
        <div className="card">Loading dispatch data…</div>
      ) : (
        <>
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Open Exchanges</h2>
            <div className="space-y-3">
              {exchanges.map((exchange) => (
                <div key={exchange.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-safe-900">Exchange #{exchange.id.slice(0, 8).toUpperCase()}</p>
                    <span className="badge-active capitalize">{exchange.status}</span>
                  </div>
                  <p className="text-xs text-safe-500">{exchange.pickup} to {exchange.dropoff}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-purple-800 capitalize">
                      {exchange.vehicle_type} vehicle
                    </span>
                    {(exchange.quoted_total_cents || exchange.quoted_distance_miles || exchange.requested_service_at) && (
                      <>
                        {exchange.quoted_total_cents ? (
                          <span className="rounded-full bg-warm-100 px-2.5 py-1 text-warm-800">
                            Quote ${(exchange.quoted_total_cents / 100).toFixed(2)}
                          </span>
                        ) : null}
                        {exchange.quoted_distance_miles ? (
                          <span className="rounded-full bg-safe-100 px-2.5 py-1 text-safe-700">
                            {exchange.quoted_distance_miles} mi · {exchange.quoted_duration_minutes ?? 0} min
                          </span>
                        ) : null}
                        {exchange.service_window_mode ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
                            {exchange.service_window_mode === "scheduled" && exchange.requested_service_at
                              ? `Scheduled ${new Date(exchange.requested_service_at).toLocaleString()}`
                              : "ASAP"}
                          </span>
                        ) : null}
                        {exchange.quoted_is_after_hours ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">After-hours</span> : null}
                        {exchange.quoted_is_weekend ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">Weekend</span> : null}
                        {exchange.quoted_is_high_risk ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">High-risk</span> : null}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
                    <select
                      className="input"
                      value={selectedCourier[exchange.id] ?? exchange.courier_id ?? ""}
                      onChange={(event) =>
                        setSelectedCourier((prev) => ({
                          ...prev,
                          [exchange.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select courier</option>
                      {couriers.map((courier) => (
                        <option key={courier.id} value={courier.id}>
                          {courier.email}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={lookupId === exchange.id}
                      onClick={() => findNearby(exchange)}
                    >
                      {lookupId === exchange.id ? "Searching..." : "Find Nearby"}
                    </button>

                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => assignCourier(exchange)}
                    >
                      Assign
                    </button>

                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => updateStatus(exchange, "assigned")}
                    >
                      Mark Assigned
                    </button>

                    <button
                      className="btn-primary"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => updateStatus(exchange, "completed")}
                    >
                      Complete
                    </button>
                  </div>

                  {nearbyCouriers[exchange.id]?.length ? (
                    <div className="rounded-xl border border-safe-100 bg-white px-3 py-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-500">Nearby courier matches</p>
                      <div className="space-y-2">
                        {nearbyCouriers[exchange.id].map((courier) => (
                          <button
                            key={courier.courier_id}
                            type="button"
                            className="w-full rounded-lg border border-safe-100 px-3 py-2 text-left hover:bg-safe-50"
                            onClick={() =>
                              setSelectedCourier((prev) => ({
                                ...prev,
                                [exchange.id]: courier.user_id,
                              }))
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-safe-900">
                                {courier.first_name} {courier.last_name}
                              </span>
                              <span className="text-xs text-safe-500">
                                {courier.distance_miles.toFixed(1)} mi · {courier.vehicle_type}
                              </span>
                            </div>
                            <p className="text-xs text-safe-500">
                              Rating {courier.rating ?? 0} · {courier.total_deliveries} deliveries · {courier.status}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-safe-900">Dispatch Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-safe-500">No events yet.</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-safe-900 capitalize">{event.event_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-safe-400">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-safe-500 mt-1">Exchange #{event.exchange_id.slice(0, 8).toUpperCase()}</p>
                    {event.note && <p className="text-sm text-safe-700 mt-2">{event.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

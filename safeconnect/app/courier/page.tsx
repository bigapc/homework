"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  items: string
  status: "pending" | "assigned" | "completed"
  created_at: string
}

export default function CourierPortal() {
  const router = useRouter()
  const [rows, setRows] = useState<Exchange[]>([])
  const [courierId, setCourierId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [savingId, setSavingId] = useState("")
  const [trackingId, setTrackingId] = useState("")

  const loadAssignedExchanges = useCallback(async () => {
    setLoading(true)
    setError("")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setLoading(false)
      router.push("/login")
      return
    }

    setCourierId(user.id)

    const { data, error: fetchError } = await supabase
      .from("exchanges")
      .select("id,pickup,dropoff,items,status,created_at")
      .eq("courier_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data ?? []) as Exchange[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadAssignedExchanges()
  }, [loadAssignedExchanges])

  const markCompleted = async (id: string) => {
    setSavingId(id)
    setNotice("")
    setError("")

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({ status: "completed" })
      .eq("id", id)

    if (updateError) {
      setError(updateError.message)
      setSavingId("")
      return
    }

    setRows((previous) =>
      previous.map((exchange) =>
        exchange.id === id ? { ...exchange, status: "completed" } : exchange
      )
    )
    setNotice("Delivery status updated.")
    setSavingId("")
  }

  const shareCurrentLocation = async (exchange: Exchange) => {
    setTrackingId(exchange.id)
    setError("")
    setNotice("")

    if (!courierId) {
      setError("Courier session is missing. Please refresh and try again.")
      setTrackingId("")
      return
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device/browser.")
      setTrackingId("")
      return
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      })
    }).catch(() => null)

    if (!position) {
      setError("Could not access your location. Please allow location access and try again.")
      setTrackingId("")
      return
    }

    const { error: insertError } = await supabase.from("tracking").insert({
      request_id: exchange.id,
      courier_id: courierId,
      route_lat: position.coords.latitude,
      route_lng: position.coords.longitude,
      status: exchange.status === "completed" ? "delivered" : "enroute",
    })

    if (insertError) {
      setError(insertError.message)
      setTrackingId("")
      return
    }

    setNotice("Current location shared successfully.")
    setTrackingId("")
  }

  const statusConfig: Record<Exchange["status"], { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "badge-pending" },
    assigned:  { label: "Assigned",  cls: "badge-active"  },
    completed: { label: "Completed", cls: "badge-done"    },
  }

  return (
    <div className="section-container space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Courier Dashboard</p>
          <h1 className="text-3xl font-bold text-safe-900">Active Deliveries</h1>
          <p className="text-safe-500 text-sm">Manage your assigned exchanges and share live location.</p>
        </div>
        <button
          type="button"
          onClick={loadAssignedExchanges}
          className="btn-secondary text-sm px-4 py-2"
        >
          ↺ Refresh
        </button>
      </div>

      {error  && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}

      {loading ? (
        <div className="card py-12 text-center animate-pulse-soft">
          <p className="text-safe-400">Loading your assigned exchanges…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card py-14 text-center space-y-3">
          <p className="text-4xl">🚚</p>
          <p className="text-safe-700 font-semibold">No assigned exchanges yet.</p>
          <p className="text-safe-400 text-sm">You will see deliveries here once an admin assigns them to you.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((exchange) => {
            const cfg = statusConfig[exchange.status]
            const isSharing   = trackingId === exchange.id
            const isCompleting = savingId  === exchange.id
            return (
              <div key={exchange.id} className="card space-y-4 hover:shadow-card-lg transition-shadow">

                {/* Card header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-safe-900">
                      Delivery #{exchange.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-safe-400 mt-0.5">
                      {new Date(exchange.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={cfg.cls}>{cfg.label}</span>
                </div>

                {/* Route */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-safe-50 rounded-xl p-3 border border-safe-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-400 mb-1">Pickup</p>
                    <p className="text-sm font-medium text-safe-800">{exchange.pickup}</p>
                  </div>
                  <div className="bg-safe-50 rounded-xl p-3 border border-safe-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-400 mb-1">Dropoff</p>
                    <p className="text-sm font-medium text-safe-800">{exchange.dropoff}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-safe-50 rounded-xl p-3 border border-safe-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-400 mb-1">Items</p>
                  <p className="text-sm text-safe-700 whitespace-pre-wrap">{exchange.items}</p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    disabled={isSharing}
                    onClick={() => shareCurrentLocation(exchange)}
                    className="btn-secondary text-sm px-5 py-2"
                  >
                    {isSharing ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-safe-400/40 border-t-safe-600 rounded-full animate-spin" />
                        Sharing location…
                      </span>
                    ) : (
                      "📍 Share Location"
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={exchange.status === "completed" || isCompleting}
                    onClick={() => markCompleted(exchange.id)}
                    className="btn-primary text-sm px-5 py-2"
                  >
                    {isCompleting ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Updating…
                      </span>
                    ) : exchange.status === "completed" ? (
                      "✓ Delivery Complete"
                    ) : (
                      "Mark as Completed"
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

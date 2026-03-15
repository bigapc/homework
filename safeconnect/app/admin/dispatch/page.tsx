"use client"

import { useCallback, useEffect, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"

type Courier = {
  id: string
  email: string
}

type Exchange = {
  id: string
  user_id: string
  courier_id: string | null
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
}

type DispatchEvent = {
  id: string
  exchange_id: string
  event_type: "assigned" | "reassigned" | "status_changed" | "note"
  note: string | null
  created_at: string
}

function AdminDispatchContent() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [events, setEvents] = useState<DispatchEvent[]>([])
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [courierRes, exchangeRes, eventRes] = await Promise.all([
      supabase.from("users").select("id,email").eq("role", "courier").order("email", { ascending: true }),
      supabase
        .from("exchanges")
        .select("id,user_id,courier_id,pickup,dropoff,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("dispatch_events")
        .select("id,exchange_id,event_type,note,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    if (courierRes.error || exchangeRes.error || eventRes.error) {
      setError(courierRes.error?.message || exchangeRes.error?.message || eventRes.error?.message || "Unable to load dispatch data.")
      setLoading(false)
      return
    }

    setCouriers((courierRes.data ?? []) as Courier[])
    setExchanges((exchangeRes.data ?? []) as Exchange[])
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
        note: exchange.courier_id ? "Courier reassigned by admin dispatch." : "Courier assigned by admin dispatch.",
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
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Admin Dispatch</p>
        <h1 className="text-3xl font-bold text-safe-900">Dispatch Control Panel</h1>
        <p className="text-safe-500 text-sm mt-1">Assign couriers, change status, and track dispatch events.</p>
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
                      <p className="text-sm font-semibold text-safe-900 capitalize">{event.event_type.replace("_", " ")}</p>
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

export default function AdminDispatchPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Checking admin dispatch access…">
      <AdminDispatchContent />
    </ProtectedRoute>
  )
}

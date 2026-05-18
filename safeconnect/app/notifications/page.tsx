"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"

type SurvivorNotification = {
  id: string
  exchange_id: string | null
  template: string
  payload: Record<string, unknown> | null
  priority: string | null
  status: string
  acknowledged_at: string | null
  created_at: string
}

function titleFor(template: string) {
  const labels: Record<string, string> = {
    survivor_payment_confirmed: "Payment confirmed",
    survivor_courier_assigned: "Courier assigned",
    survivor_courier_enroute: "Courier en route",
    survivor_delivery_completed: "Delivery completed",
    survivor_request_canceled: "Request canceled",
    survivor_tracking_update: "Tracking update",
    survivor_tracking_delivered: "Delivered tracking update",
  }

  return labels[template] ?? template.replace(/_/g, " ")
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : "-"
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<SurvivorNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.acknowledged_at).length,
    [notifications]
  )

  const loadNotifications = useCallback(async () => {
    setError("")
    const { data, error: loadError } = await supabase
      .from("notification_events")
      .select("id,exchange_id,template,payload,priority,status,acknowledged_at,created_at")
      .order("created_at", { ascending: false })
      .limit(40)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setNotifications((data ?? []) as SurvivorNotification[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const channel = supabase
      .channel("survivor-notification-center")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification_events" },
        (payload) => {
          const row = payload.new as SurvivorNotification
          setNotifications((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 40))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function acknowledge(id: string) {
    const { error: updateError } = await supabase
      .from("notification_events")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((current) =>
      current.map((item) => item.id === id ? { ...item, acknowledged_at: new Date().toISOString() } : item)
    )
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Survivor Portal</p>
          <h1 className="text-3xl font-bold text-safe-900">Notification Center</h1>
          <p className="text-sm text-safe-500 mt-1">Payment, courier, tracking, and delivery updates in one secure place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/request" className="btn-secondary text-sm px-4 py-2">Back to Requests</Link>
          <button type="button" onClick={loadNotifications} className="btn-primary text-sm px-4 py-2">Refresh</button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-safe-900">Unread updates</p>
          <p className="text-xs text-safe-500">Acknowledge notifications after you review them.</p>
        </div>
        <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700">{unreadCount} unread</span>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      {loading ? (
        <div className="card text-sm text-safe-500">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="card text-sm text-safe-500">No notifications yet.</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <article key={item.id} className={`card border ${item.acknowledged_at ? "border-safe-100 opacity-80" : "border-red-200"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-safe-900 capitalize">{titleFor(item.template)}</h2>
                    {!item.acknowledged_at ? <span className="badge-pending">New</span> : <span className="badge-done">Acknowledged</span>}
                    {item.priority === "high" ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">High</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-safe-400">Request #{shortId(item.exchange_id)} • {new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.exchange_id ? (
                    <Link href={`/track/${item.exchange_id}`} className="btn-secondary text-xs px-3 py-2">Track Request</Link>
                  ) : null}
                  {!item.acknowledged_at ? (
                    <button type="button" onClick={() => acknowledge(item.id)} className="btn-primary text-xs px-3 py-2">Acknowledge</button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-safe-700 sm:grid-cols-2">
                {item.payload?.pickup ? <p><span className="font-semibold text-safe-900">Pickup:</span> {String(item.payload.pickup)}</p> : null}
                {item.payload?.dropoff ? <p><span className="font-semibold text-safe-900">Dropoff:</span> {String(item.payload.dropoff)}</p> : null}
                {item.payload?.status ? <p><span className="font-semibold text-safe-900">Status:</span> {String(item.payload.status)}</p> : null}
                {item.payload?.paymentStatus ? <p><span className="font-semibold text-safe-900">Payment:</span> {String(item.payload.paymentStatus)}</p> : null}
                {item.payload?.trackingStatus ? <p><span className="font-semibold text-safe-900">Tracking:</span> {String(item.payload.trackingStatus)}</p> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Opening notification center...">
      <NotificationsContent />
    </ProtectedRoute>
  )
}

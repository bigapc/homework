"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import TrackingMap from "@/components/TrackingMap"
import { supabase } from "@/lib/supabase"

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
}

type TrackingPoint = {
  id: string
  request_id: string
  route_lat: number | null
  route_lng: number | null
  status: "enroute" | "delivered" | "canceled"
  updated_at: string
}

function statusClasses(status: Exchange["status"]) {
  if (status === "pending") {
    return "badge-pending"
  }

  if (status === "assigned") {
    return "badge-active"
  }

  return "badge-done"
}

function LiveTrackingPageContent() {
  const params = useParams<{ id: string }>()
  const requestId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadTracking = useCallback(async () => {
    if (!requestId) {
      setError("Tracking request is missing.")
      setLoading(false)
      return
    }

    setError("")

    const [{ data: exchangeRow, error: exchangeError }, { data: trackingRows, error: trackingError }] = await Promise.all([
      supabase
        .from("exchanges")
        .select("id,pickup,dropoff,status,created_at")
        .eq("id", requestId)
        .single(),
      supabase
        .from("tracking")
        .select("id,request_id,route_lat,route_lng,status,updated_at")
        .eq("request_id", requestId)
        .order("updated_at", { ascending: false }),
    ])

    if (exchangeError) {
      setError("We could not load this tracking request.")
      setExchange(null)
      setTrackingPoints([])
      setLoading(false)
      return
    }

    if (trackingError) {
      setError(trackingError.message)
      setTrackingPoints([])
      setLoading(false)
      return
    }

    setExchange(exchangeRow as Exchange)
    setTrackingPoints((trackingRows ?? []) as TrackingPoint[])
    setLastUpdatedAt(new Date())
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    loadTracking()
  }, [loadTracking])

  useEffect(() => {
    if (!requestId) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadTracking()
      }
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadTracking, requestId])

  useEffect(() => {
    if (!requestId) {
      return
    }

    const channel = supabase
      .channel(`tracking-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracking",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          loadTracking()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTracking, requestId])

  const latestPoint = useMemo(() => trackingPoints[0] ?? null, [trackingPoints])

  if (loading) {
    return (
      <div className="page-container">
        <div className="card py-10 text-center text-safe-500">Loading live tracking…</div>
      </div>
    )
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Live Tracking</p>
          <h1 className="text-3xl font-bold text-safe-900">Request #{requestId?.slice(0, 8).toUpperCase()}</h1>
          {exchange && (
            <p className="text-safe-500 text-sm mt-1">
              {exchange.pickup} to {exchange.dropoff}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exchange && <span className={statusClasses(exchange.status)}>{exchange.status}</span>}
          <Link href="/request" className="btn-secondary text-sm px-4 py-2">
            Back to Requests
          </Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {!exchange ? (
        <div className="card text-safe-500">No tracking request found.</div>
      ) : latestPoint && latestPoint.route_lat != null && latestPoint.route_lng != null ? (
        <TrackingMap
          lat={latestPoint.route_lat}
          lng={latestPoint.route_lng}
          status={latestPoint.status}
          updatedAt={latestPoint.updated_at}
        />
      ) : (
        <div className="card text-safe-500">No live GPS point has been shared yet.</div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-safe-900">Tracking Timeline</h2>
          <span className="text-xs text-safe-400">
            Last refreshed {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "-"}
          </span>
        </div>

        {trackingPoints.length === 0 ? (
          <p className="text-sm text-safe-500">Waiting for the courier to share a location update.</p>
        ) : (
          <div className="space-y-3">
            {trackingPoints.map((point) => (
              <div key={point.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge-active capitalize">{point.status}</span>
                  <span className="text-xs text-safe-400">{new Date(point.updated_at).toLocaleString()}</span>
                </div>
                {point.route_lat != null && point.route_lng != null ? (
                  <p className="mt-2 text-sm text-safe-700">
                    {point.route_lat.toFixed(5)}, {point.route_lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-safe-500">Location unavailable for this event.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiveTrackingPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Checking tracking access…">
      <LiveTrackingPageContent />
    </ProtectedRoute>
  )
}

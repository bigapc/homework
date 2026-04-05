"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import TrackingMap from "@/components/TrackingMap"
import { encryptJson } from "@/lib/safetyCrypto"
import { getClientEncryptionKeyVersion } from "@/lib/encryptionVersion"
import PricingQuote, { type PricingResult, VEHICLE_TYPES } from "@/components/PricingQuote"
import { buildExchangeQuoteColumns, isMissingExchangeQuoteColumnsError } from "@/lib/exchangeQuote"

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
  quoted_total_cents?: number | null
  quoted_distance_miles?: number | null
  quoted_duration_minutes?: number | null
}

type TrackingPoint = {
  request_id: string
  route_lat: number | null
  route_lng: number | null
  status: "enroute" | "delivered" | "canceled"
  updated_at: string
}

export default function RequestCourier() {
  const encryptionKeyVersion = getClientEncryptionKeyVersion()
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    contact: "",
    pickup: "",
    dropoff: "",
    items: "",
    encryptionPasscode: "",
  })
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [quoteResult, setQuoteResult] = useState<PricingResult | null>(null)
  const [myRequests, setMyRequests] = useState<Exchange[]>([])
  const [latestTrackingByRequest, setLatestTrackingByRequest] = useState<Record<string, TrackingPoint>>({})
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadMyRequests = useCallback(async () => {
    setListLoading(true)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setIsAuthenticated(false)
      setMyRequests([])
      setLatestTrackingByRequest({})
      setLastUpdatedAt(null)
      setListLoading(false)
      return
    }

    setIsAuthenticated(true)

    const { data, error: fetchError } = await supabase
      .from("exchanges")
      .select("id,pickup,dropoff,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setMyRequests([])
      setListLoading(false)
      return
    }

    setMyRequests((data ?? []) as Exchange[])

    const requestIds = (data ?? []).map((entry) => entry.id)

    if (requestIds.length === 0) {
      setLatestTrackingByRequest({})
      setLastUpdatedAt(new Date())
      setListLoading(false)
      return
    }

    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking")
      .select("request_id,route_lat,route_lng,status,updated_at")
      .in("request_id", requestIds)
      .order("updated_at", { ascending: false })

    if (trackingError) {
      setError(trackingError.message)
      setLatestTrackingByRequest({})
      setListLoading(false)
      return
    }

    const latestByRequest: Record<string, TrackingPoint> = {}
    for (const row of (trackingData ?? []) as TrackingPoint[]) {
      if (!latestByRequest[row.request_id]) {
        latestByRequest[row.request_id] = row
      }
    }

    setLatestTrackingByRequest(latestByRequest)
    setLastUpdatedAt(new Date())
    setListLoading(false)
  }, [])

  useEffect(() => {
    loadMyRequests()
  }, [loadMyRequests])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadMyRequests()
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [isAuthenticated, loadMyRequests])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted || !user) {
        if (mounted) {
          setIsRealtimeConnected(false)
        }
        return
      }

      channel = supabase
        .channel(`survivor-live-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "exchanges" },
          () => {
            loadMyRequests()
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tracking" },
          () => {
            loadMyRequests()
          }
        )
        .subscribe((status) => {
          setIsRealtimeConnected(status === "SUBSCRIBED")
        })
    }

    setupRealtime()

    return () => {
      mounted = false
      setIsRealtimeConnected(false)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadMyRequests])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess("")
    setError("")
    let successMessage = "Request submitted securely."

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError("Sign in to submit your request securely. Your pricing quote will still be available before sign-in.")
      setLoading(false)
      router.push("/login?from=/request")
      return
    }

    const quoteSnapshot = quoteResult
      ? [
          "Quote Snapshot:",
          `Vehicle: ${quoteResult.vehicleType} (${VEHICLE_TYPES[quoteResult.vehicleType]?.name || quoteResult.vehicleType})`,
          `Requested timing: ${quoteResult.requestTimingLabel}`,
          `Estimated total: $${quoteResult.total.toFixed(2)}`,
          `Estimated miles: ${quoteResult.miles} mi`,
          `Estimated drive time: ${quoteResult.minutes} min`,
          `Base rate: $${quoteResult.breakdown.baseRate.toFixed(2)}`,
          `Mileage charge: $${quoteResult.breakdown.mileage.toFixed(2)}`,
          `Service fee: $${quoteResult.breakdown.svcFee.toFixed(2)}`,
          ...(quoteResult.breakdown.afterHours > 0
            ? [`After-hours surcharge: $${quoteResult.breakdown.afterHours.toFixed(2)}`]
            : []),
          ...(quoteResult.breakdown.weekend > 0
            ? [`Weekend surcharge: $${quoteResult.breakdown.weekend.toFixed(2)}`]
            : []),
          ...(quoteResult.breakdown.highRiskFee > 0
            ? [`High-risk handling: $${quoteResult.breakdown.highRiskFee.toFixed(2)}`]
            : []),
          "",
        ]
      : []

    const fullItemsDescription = [
      `Requested by: ${form.name}`,
      `Contact: ${form.contact}`,
      "",
      ...quoteSnapshot,
      form.items,
    ].join("\n")

    const payload: Record<string, string | boolean | number> = {
      user_id: user.id,
      pickup: form.pickup,
      dropoff: form.dropoff,
      items: fullItemsDescription,
      status: "pending",
      items_encrypted: false,
      encryption_key_version: encryptionKeyVersion,
      vehicle_type: quoteResult?.vehicleType || 'standard',
    }

    if (quoteResult) {
      Object.assign(payload, buildExchangeQuoteColumns(quoteResult))
    }

    if (form.encryptionPasscode.trim().length >= 6) {
      const encrypted = await encryptJson(
        { items: fullItemsDescription },
        form.encryptionPasscode.trim()
      )

      payload.items = "[Encrypted item description]"
      payload.items_encrypted = true
      payload.encrypted_items_payload = encrypted.cipherText
      payload.encrypted_items_iv = encrypted.iv
      payload.encrypted_items_salt = encrypted.salt
    }

    let { error: insertError } = await supabase.from("exchanges").insert(payload)

    if (insertError?.message?.includes("encryption_key_version")) {
      const withoutVersion = { ...payload }
      delete withoutVersion.encryption_key_version

      const retry = await supabase.from("exchanges").insert(withoutVersion)
      insertError = retry.error ?? null
    }

    if (insertError && isMissingExchangeQuoteColumnsError(insertError.message)) {
      const withoutQuoteColumns = { ...payload }

      delete withoutQuoteColumns.service_window_mode
      delete withoutQuoteColumns.requested_service_at
      delete withoutQuoteColumns.quoted_distance_miles
      delete withoutQuoteColumns.quoted_duration_minutes
      delete withoutQuoteColumns.quoted_base_rate_cents
      delete withoutQuoteColumns.quoted_mileage_cents
      delete withoutQuoteColumns.quoted_after_hours_cents
      delete withoutQuoteColumns.quoted_weekend_cents
      delete withoutQuoteColumns.quoted_high_risk_cents
      delete withoutQuoteColumns.quoted_fuel_surcharge_cents
      delete withoutQuoteColumns.quoted_service_fee_cents
      delete withoutQuoteColumns.quoted_total_cents
      delete withoutQuoteColumns.quoted_is_after_hours
      delete withoutQuoteColumns.quoted_is_weekend
      delete withoutQuoteColumns.quoted_is_high_risk
      delete withoutQuoteColumns.quoted_at

      const retry = await supabase.from("exchanges").insert(withoutQuoteColumns)
      insertError = retry.error ?? null

      if (!insertError && quoteResult) {
        successMessage = "Request submitted, but dedicated quote columns are not enabled yet. Apply Supabase migration 014 to persist quote analytics fields."
      }
    }

    if (insertError && payload.items_encrypted) {
      const fallback = await supabase.from("exchanges").insert({
        user_id: user.id,
        pickup: form.pickup,
        dropoff: form.dropoff,
        items: fullItemsDescription,
        status: "pending",
        ...(quoteResult ? buildExchangeQuoteColumns(quoteResult) : {}),
      })

      insertError = fallback.error ?? null

      if (insertError && isMissingExchangeQuoteColumnsError(insertError.message)) {
        const fallbackWithoutQuote = await supabase.from("exchanges").insert({
          user_id: user.id,
          pickup: form.pickup,
          dropoff: form.dropoff,
          items: fullItemsDescription,
          status: "pending",
        })

        insertError = fallbackWithoutQuote.error ?? null

        if (!insertError && quoteResult) {
          successMessage = "Request submitted, but dedicated quote columns are not enabled yet. Apply Supabase migration 014 to persist quote analytics fields."
        }
      }

      if (!insertError) {
        successMessage = "Request submitted, but encrypted item storage is not enabled yet. Apply Phase 3 DB migration 011."
      }
    }

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSuccess(successMessage)
    setForm({
      name: "",
      contact: "",
      pickup: "",
      dropoff: "",
      items: "",
      encryptionPasscode: "",
    })
    setQuoteResult(null)
    await loadMyRequests()
    setLoading(false)
  }

  const statusConfig: Record<Exchange["status"], { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "badge-pending" },
    assigned:  { label: "Assigned",  cls: "badge-active"  },
    completed: { label: "Completed", cls: "badge-done"    },
  }

  return (
    <div className="page-container space-y-8 animate-fade-in">

      {/* Page header */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Survivor Portal</p>
        <h1 className="text-3xl font-bold text-safe-900">Request Safe Courier Pickup</h1>
        <p className="text-safe-500 text-sm">
          All requests are confidential. A neutral courier will be dispatched on your behalf.
        </p>
      </div>

      {/* Confidentiality notice */}
      <div className="alert-info flex gap-3">
        <span className="text-xl shrink-0">🔒</span>
        <div>
          <p className="font-semibold text-safe-800 text-sm">Your information is private</p>
          <p className="text-xs mt-0.5">Your name and contact details are never shared with the other party.</p>
        </div>
      </div>

      {isAuthenticated === false && (
        <div className="card border border-warm-200 bg-warm-50/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-safe-900">Instant pricing is open to visitors.</p>
              <p className="text-xs text-safe-600 mt-1">
                Enter pickup and dropoff to get a live mileage quote now. Sign in only when you&apos;re ready to submit and track the request.
              </p>
            </div>
            <Link href="/login?from=/request" className="btn-secondary whitespace-nowrap">
              Sign In To Book
            </Link>
          </div>
        </div>
      )}

      {/* Request form */}
      {/* Real-time pricing quote */}
      <PricingQuote
        onQuoteReady={(result) => {
          setQuoteResult(result)
          setForm((prev) => ({
            ...prev,
            pickup: result.pickup.label,
            dropoff: result.dropoff.label,
          }))
        }}
      />

      {/* Request form */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-safe-900">New Exchange Request</h2>
          {quoteResult && (
            <span className="inline-flex items-center gap-1.5 bg-warm-400/15 text-warm-600 text-xs font-semibold px-3 py-1 rounded-full">
              <span className="text-[10px]">💰</span>
              Est. ${quoteResult.total.toFixed(2)} · {quoteResult.miles} mi
            </span>
          )}
        </div>

        {error   && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Your Name</label>
            <input
              className="input"
              placeholder="First name or alias"
              required
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
            />
          </div>
          <div>
            <label className="label">Safe Contact Method</label>
            <input
              className="input"
              placeholder="Phone, email, or Signal number"
              required
              value={form.contact}
              onChange={(e) => setForm({...form, contact: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Pickup Location</label>
            <input
              className="input"
              placeholder="Address where items are located"
              required
              value={form.pickup}
              onChange={(e) => setForm({...form, pickup: e.target.value})}
            />
          </div>
          <div>
            <label className="label">Dropoff Location</label>
            <input
              className="input"
              placeholder="Address to deliver to"
              required
              value={form.dropoff}
              onChange={(e) => setForm({...form, dropoff: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="label">Items to Retrieve</label>
          <textarea
            className="input min-h-[100px] resize-y"
            placeholder="Describe the items: clothing, documents, medication, electronics…"
            required
            value={form.items}
            onChange={(e) => setForm({...form, items: e.target.value})}
          />
        </div>

        <div>
          <label className="label">Optional End-to-End Encryption Passcode</label>
          <input
            className="input"
            type="password"
            placeholder="Leave blank for standard request; 6+ chars enables encrypted item text"
            value={form.encryptionPasscode}
            onChange={(e) => setForm({ ...form, encryptionPasscode: e.target.value })}
          />
          <p className="text-xs text-safe-500 mt-1">
            When provided, item descriptions are encrypted before storage.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-base py-3"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Submitting securely…
            </span>
          ) : (
            "Submit Request Securely"
          )}
        </button>
      </form>

      {/* My Requests panel */}
      {isAuthenticated ? (
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-safe-900">My Requests</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={isRealtimeConnected ? "badge-live" : "badge-offline"}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? "bg-emerald-500 animate-pulse-soft" : "bg-slate-400"}`} />
              {isRealtimeConnected ? "Live" : "Offline"}
            </span>
            {lastUpdatedAt && (
              <span className="text-xs text-safe-400">Updated {lastUpdatedAt.toLocaleTimeString()}</span>
            )}
            <button
              type="button"
              onClick={loadMyRequests}
              className="text-xs font-medium text-safe-600 hover:text-safe-900 underline transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {listLoading ? (
          <div className="py-6 text-center text-sm text-safe-400 animate-pulse-soft">Loading your requests…</div>
        ) : myRequests.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-safe-500">No requests submitted yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((request) => {
              const cfg = statusConfig[request.status]
              const tracking = latestTrackingByRequest[request.id]
              return (
                <div key={request.id} className="border border-safe-100 rounded-xl p-4 bg-safe-50/50 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-safe-900 text-sm">Request #{request.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-safe-400">{new Date(request.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <span className={cfg.cls}>{cfg.label}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-safe-600">
                    <p><span className="font-medium text-safe-800">Pickup:</span> {request.pickup}</p>
                    <p><span className="font-medium text-safe-800">Dropoff:</span> {request.dropoff}</p>
                  </div>

                  {tracking ? (
                    tracking.route_lat != null && tracking.route_lng != null ? (
                      <div className="space-y-2">
                        <TrackingMap
                          lat={tracking.route_lat}
                          lng={tracking.route_lng}
                          status={tracking.status}
                          updatedAt={tracking.updated_at}
                        />
                        <Link href={`/track/${request.id}`} className="inline-flex text-xs font-medium text-safe-700 underline hover:text-safe-900">
                          Open dedicated tracking page
                        </Link>
                      </div>
                    ) : (
                      <div className="bg-white border border-safe-100 rounded-lg px-3 py-2 flex flex-wrap gap-4 text-xs text-safe-600">
                        <span>
                          <span className="font-medium text-safe-800">Courier status:</span>{" "}
                          <span className="capitalize">{tracking.status}</span>
                        </span>
                        <span className="text-safe-400">{new Date(tracking.updated_at).toLocaleTimeString()}</span>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-safe-400 italic">No live tracking update yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      ) : (
      <div className="card space-y-3">
        <h2 className="text-lg font-bold text-safe-900">Track Requests After Sign-In</h2>
        <p className="text-sm text-safe-500">
          Sign in to save your courier booking, view live request status, and monitor assigned courier updates.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login?from=/request" className="btn-primary">Sign In</Link>
          <Link href="/signup" className="btn-secondary">Create Account</Link>
        </div>
      </div>
      )}
    </div>
  )
}

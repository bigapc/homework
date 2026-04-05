"use client"

import { useState } from "react"

export default function CourierTrackingPage() {
  const [status, setStatus] = useState<"online" | "offline">("offline")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const updateStatus = async (next: "online" | "offline") => {
    setLoading(true)
    setNotice("")
    setError("")

    const res = await fetch("/api/courier/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next }),
    })

    const payload = (await res.json().catch(() => null)) as { error?: string; status?: string } | null

    if (!res.ok) {
      setError(payload?.error || "Failed to update availability")
      setLoading(false)
      return
    }

    setStatus(next)
    setNotice(payload?.status || `Courier marked ${next}.`)
    setLoading(false)
  }

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.")
      return
    }

    setLoading(true)
    setNotice("")
    setError("")

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const res = await fetch("/api/courier/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "location",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_meters: Math.round(position.coords.accuracy),
          }),
        })

        const payload = (await res.json().catch(() => null)) as { error?: string; status?: string } | null

        if (!res.ok) {
          setError(payload?.error || "Failed to share location")
        } else {
          setNotice(payload?.status || "Location shared successfully.")
        }

        setLoading(false)
      },
      () => {
        setError("Unable to access location. Please enable permissions.")
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Courier Live Tracking</h1>
      <p className="text-slate-600">Set availability and update live location so dispatch can assign nearby emergency requests.</p>

      {error ? <div className="alert-error">{error}</div> : null}
      {notice ? <div className="alert-success">{notice}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <p className="text-sm text-slate-700">
          Current status: <span className="font-semibold uppercase">{status}</span>
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || status === "online"}
            onClick={() => updateStatus("online")}
            className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Go Online
          </button>

          <button
            type="button"
            disabled={loading || status === "offline"}
            onClick={() => updateStatus("offline")}
            className="rounded-xl bg-slate-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Go Offline
          </button>

          <button
            type="button"
            disabled={loading || status !== "online"}
            onClick={shareLocation}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Share Current Location
          </button>
        </div>
      </div>
    </div>
  )
}

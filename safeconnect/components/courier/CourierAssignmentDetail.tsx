"use client"

import Link from "next/link"
import { useState } from "react"

type AssignmentDetail = {
  id: string
  pickup: string
  dropoff: string
  status: string
  created_at: string
  items?: string | null
  vehicle_type?: string | null
}

export default function CourierAssignmentDetail({ assignment }: { assignment: AssignmentDetail }) {
  const [currentStatus, setCurrentStatus] = useState(assignment.status)
  const [loadingAction, setLoadingAction] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function runAction(action: "accept" | "picked_up" | "start_tracking" | "delivered") {
    setLoadingAction(action)
    setMessage("")
    setError("")

    let coords: { latitude: number; longitude: number } | undefined

    if (action === "start_tracking" || action === "delivered") {
      coords = await new Promise<{ latitude: number; longitude: number } | undefined>((resolve) => {
        if (!navigator.geolocation) {
          resolve(undefined)
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          () => resolve(undefined),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        )
      })
    }

    const response = await fetch(`/api/courier/assignments/${assignment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...coords }),
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string }

    if (!response.ok) {
      setError(payload.error || "Unable to update assignment.")
      setLoadingAction("")
      return
    }

    if (payload.status) {
      setCurrentStatus(payload.status)
    }

    setMessage(`Action complete: ${action.replace(/_/g, " ")}.`)
    setLoadingAction("")
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Courier Assignment</p>
          <h1 className="text-3xl font-bold text-safe-900">Assignment #{assignment.id.slice(0, 8).toUpperCase()}</h1>
          <p className="mt-2 text-safe-600">Created {new Date(assignment.created_at).toLocaleString()}</p>
        </div>
        <Link href="/courier/assignments" className="btn-secondary text-sm px-4 py-2">
          Back to Assignments
        </Link>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}
      {message ? <div className="alert-success">{message}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <p className="text-lg font-semibold text-slate-900 capitalize">{currentStatus.replace(/_/g, " ")}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 capitalize">{assignment.vehicle_type || "standard"}</span>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Pickup</p>
          <p className="text-slate-900 font-medium">{assignment.pickup}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Dropoff</p>
          <p className="text-slate-900 font-medium">{assignment.dropoff}</p>
        </div>

        {assignment.items ? (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Items</p>
            <p className="text-slate-700 whitespace-pre-wrap">{assignment.items}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Workflow Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => runAction("accept")} disabled={loadingAction !== ""} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {loadingAction === "accept" ? "Saving..." : "Accept Assignment"}
          </button>
          <button type="button" onClick={() => runAction("picked_up")} disabled={loadingAction !== ""} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {loadingAction === "picked_up" ? "Saving..." : "Mark Picked Up"}
          </button>
          <button type="button" onClick={() => runAction("start_tracking")} disabled={loadingAction !== ""} className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
            {loadingAction === "start_tracking" ? "Saving..." : "Start Tracking"}
          </button>
          <button type="button" onClick={() => runAction("delivered")} disabled={loadingAction !== ""} className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50">
            {loadingAction === "delivered" ? "Saving..." : "Mark Delivered"}
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Start Tracking captures your current GPS point for the live tracker. Mark Delivered records the final delivered location.
        </p>
      </div>
    </div>
  )
}
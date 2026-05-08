"use client"

import { useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"

type SupervisorMetrics = {
  openRequests: number
  assignedRequests: number
  completedToday: number
  activeCouriers: number
}

type Incident = {
  id: string
  severity: string
  created_at: string
  reviewed_at: string | null
}

type ShiftNote = {
  id: string
  text: string
  createdAt: string
}

function SupervisorContent() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [metrics, setMetrics] = useState<SupervisorMetrics>({
    openRequests: 0,
    assignedRequests: 0,
    completedToday: 0,
    activeCouriers: 0,
  })
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])
  const [shiftNoteInput, setShiftNoteInput] = useState("")
  const [shiftNotes, setShiftNotes] = useState<ShiftNote[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError("")

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [
        openRes,
        assignedRes,
        completedRes,
        activeCouriersRes,
        incidentsRes,
      ] = await Promise.all([
        supabase.from("exchanges").select("id", { count: "exact", head: true }).in("status", ["pending", "requested"]),
        supabase.from("exchanges").select("id", { count: "exact", head: true }).eq("status", "assigned"),
        supabase.from("exchanges").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", startOfDay.toISOString()),
        supabase.from("couriers").select("user_id", { count: "exact", head: true }).eq("status", "online"),
        supabase
          .from("incident_reports")
          .select("id,severity,created_at,reviewed_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ])

      const firstError =
        openRes.error || assignedRes.error || completedRes.error || activeCouriersRes.error || incidentsRes.error

      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setMetrics({
        openRequests: openRes.count || 0,
        assignedRequests: assignedRes.count || 0,
        completedToday: completedRes.count || 0,
        activeCouriers: activeCouriersRes.count || 0,
      })
      setRecentIncidents((incidentsRes.data as Incident[]) || [])
      setLoading(false)
    }

    load()
  }, [])

  const unresolvedIncidents = useMemo(
    () => recentIncidents.filter((incident) => !incident.reviewed_at).length,
    [recentIncidents]
  )

  const addShiftNote = () => {
    const text = shiftNoteInput.trim()
    if (!text) return

    setShiftNotes((prev) => [
      {
        id: `${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
    setShiftNoteInput("")
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card py-10 text-center text-safe-500">Loading supervisor dashboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-safe-900">Supervisor Operations</h1>
        <p className="text-safe-500 mt-2">Real-time oversight for dispatch, incidents, and shift handoffs.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-safe-500">Open Requests</p>
          <p className="text-2xl font-bold text-safe-900 mt-2">{metrics.openRequests}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-safe-500">Assigned</p>
          <p className="text-2xl font-bold text-safe-900 mt-2">{metrics.assignedRequests}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-safe-500">Completed Today</p>
          <p className="text-2xl font-bold text-safe-900 mt-2">{metrics.completedToday}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-safe-500">Active Couriers</p>
          <p className="text-2xl font-bold text-safe-900 mt-2">{metrics.activeCouriers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-safe-900">Incident Queue</h2>
            <span className="badge-pending">Unresolved: {unresolvedIncidents}</span>
          </div>

          {recentIncidents.length === 0 ? (
            <p className="text-sm text-safe-500">No incidents logged.</p>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-safe-100 p-3">
                  <p className="text-sm font-semibold text-safe-900">Severity: {incident.severity}</p>
                  <p className="text-xs text-safe-500 mt-1">Reported: {new Date(incident.created_at).toLocaleString()}</p>
                  <p className="text-xs mt-1 text-safe-600">
                    {incident.reviewed_at ? `Reviewed ${new Date(incident.reviewed_at).toLocaleString()}` : "Pending review"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-4">
          <h2 className="text-lg font-semibold text-safe-900">Shift Handoff Notes</h2>
          <div className="space-y-3">
            <textarea
              className="input min-h-24"
              value={shiftNoteInput}
              onChange={(event) => setShiftNoteInput(event.target.value)}
              placeholder="Add supervisor handoff note for the next shift..."
            />
            <button type="button" className="btn-primary" onClick={addShiftNote}>
              Add Note
            </button>
          </div>

          <div className="space-y-2">
            {shiftNotes.length === 0 ? (
              <p className="text-sm text-safe-500">No notes yet for this shift.</p>
            ) : (
              shiftNotes.map((note) => (
                <div key={note.id} className="rounded-xl border border-safe-100 p-3">
                  <p className="text-sm text-safe-800">{note.text}</p>
                  <p className="text-xs text-safe-500 mt-1">{new Date(note.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function AdminSupervisorPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Checking supervisor access…">
      <SupervisorContent />
    </ProtectedRoute>
  )
}

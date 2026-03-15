"use client"

import { useCallback, useEffect, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"

type LegalDocReview = {
  id: string
  user_id: string
  file_name: string
  category: string
  created_at: string
  reviewed_at: string | null
}

type IncidentReview = {
  id: string
  user_id: string
  title: string
  severity: string
  created_at: string
  reviewed_at: string | null
}

function AdminReviewContent() {
  const [legalDocs, setLegalDocs] = useState<LegalDocReview[]>([])
  const [incidents, setIncidents] = useState<IncidentReview[]>([])
  const [loading, setLoading] = useState(true)
  const [workingKey, setWorkingKey] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [{ data: docRows, error: docError }, { data: incidentRows, error: incidentError }] = await Promise.all([
      supabase
        .from("legal_documents")
        .select("id,user_id,file_name,category,created_at,reviewed_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("incident_reports")
        .select("id,user_id,title,severity,created_at,reviewed_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    if (docError || incidentError) {
      setError(docError?.message || incidentError?.message || "Unable to load admin review data.")
      setLoading(false)
      return
    }

    setLegalDocs((docRows ?? []) as LegalDocReview[])
    setIncidents((incidentRows ?? []) as IncidentReview[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const markDocReviewed = async (doc: LegalDocReview) => {
    setWorkingKey(`doc:${doc.id}`)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    if (!adminId) {
      setError("Admin session not found.")
      setWorkingKey("")
      return
    }

    const { error: updateError } = await supabase
      .from("legal_documents")
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", doc.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingKey("")
      return
    }

    await fetch("/api/audit/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admin_review_legal_document",
        resourceType: "legal_document",
        resourceId: doc.id,
        metadata: {
          userId: doc.user_id,
          category: doc.category,
          fileName: doc.file_name,
        },
      }),
    })

    setMessage("Legal document marked as reviewed.")
    setWorkingKey("")
    await loadData()
  }

  const markIncidentReviewed = async (incident: IncidentReview) => {
    setWorkingKey(`incident:${incident.id}`)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    if (!adminId) {
      setError("Admin session not found.")
      setWorkingKey("")
      return
    }

    const { error: updateError } = await supabase
      .from("incident_reports")
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", incident.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingKey("")
      return
    }

    await fetch("/api/audit/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admin_review_incident_report",
        resourceType: "incident_report",
        resourceId: incident.id,
        metadata: {
          userId: incident.user_id,
          severity: incident.severity,
          title: incident.title,
        },
      }),
    })

    setMessage("Incident report marked as reviewed.")
    setWorkingKey("")
    await loadData()
  }

  return (
    <div className="section-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Admin Review</p>
        <h1 className="text-3xl font-bold text-safe-900">Legal + Incident Review Queue</h1>
        <p className="text-safe-500 text-sm mt-1">Mark records as reviewed and capture audit events for compliance tracking.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {loading ? (
        <div className="card">Loading review queue…</div>
      ) : (
        <>
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Legal Documents</h2>
            {legalDocs.length === 0 ? (
              <p className="text-sm text-safe-500">No legal documents yet.</p>
            ) : (
              <div className="space-y-2">
                {legalDocs.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-safe-900">{doc.file_name}</p>
                      <p className="text-xs text-safe-500">
                        {doc.category} • User {doc.user_id.slice(0, 8)} • {new Date(doc.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-safe-400 mt-1">
                        {doc.reviewed_at ? `Reviewed ${new Date(doc.reviewed_at).toLocaleString()}` : "Pending review"}
                      </p>
                    </div>
                    <button
                      className="btn-secondary text-sm"
                      type="button"
                      disabled={workingKey === `doc:${doc.id}` || Boolean(doc.reviewed_at)}
                      onClick={() => markDocReviewed(doc)}
                    >
                      {doc.reviewed_at ? "Reviewed" : workingKey === `doc:${doc.id}` ? "Saving..." : "Mark Reviewed"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Incident Reports</h2>
            {incidents.length === 0 ? (
              <p className="text-sm text-safe-500">No incident reports yet.</p>
            ) : (
              <div className="space-y-2">
                {incidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-safe-900">{incident.title}</p>
                      <p className="text-xs text-safe-500">
                        {incident.severity} • User {incident.user_id.slice(0, 8)} • {new Date(incident.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-safe-400 mt-1">
                        {incident.reviewed_at ? `Reviewed ${new Date(incident.reviewed_at).toLocaleString()}` : "Pending review"}
                      </p>
                    </div>
                    <button
                      className="btn-secondary text-sm"
                      type="button"
                      disabled={workingKey === `incident:${incident.id}` || Boolean(incident.reviewed_at)}
                      onClick={() => markIncidentReviewed(incident)}
                    >
                      {incident.reviewed_at ? "Reviewed" : workingKey === `incident:${incident.id}` ? "Saving..." : "Mark Reviewed"}
                    </button>
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

export default function AdminReviewPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Checking admin review access…">
      <AdminReviewContent />
    </ProtectedRoute>
  )
}

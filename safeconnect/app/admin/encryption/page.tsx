"use client"

import { useCallback, useEffect, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"

type EncryptionKey = {
  id: string
  key_version: number
  algorithm: string
  status: "active" | "deprecated" | "retired"
  activated_at: string
  notes: string | null
}

type RotationJob = {
  id: string
  from_version: number
  to_version: number
  target_table: "exchanges" | "incident_reports" | "safety_entries" | "safety_plans"
  status: "planned" | "in_progress" | "completed" | "manual_required" | "failed" | "cancelled"
  total_count: number
  processed_count: number
  manual_required_count: number
  created_at: string
  updated_at: string
  last_error: string | null
}

function AdminEncryptionContent() {
  const [keys, setKeys] = useState<EncryptionKey[]>([])
  const [jobs, setJobs] = useState<RotationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [creatingKey, setCreatingKey] = useState(false)
  const [creatingJob, setCreatingJob] = useState(false)
  const [executingJobId, setExecutingJobId] = useState("")
  const [keyNotes, setKeyNotes] = useState("")
  const [targetTable, setTargetTable] = useState<RotationJob["target_table"]>("exchanges")
  const [fromVersion, setFromVersion] = useState("1")
  const [toVersion, setToVersion] = useState("2")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [keysRes, jobsRes] = await Promise.all([
      fetch("/api/admin/encryption/keys"),
      fetch("/api/admin/encryption/rotation-jobs"),
    ])

    const keysJson = await keysRes.json().catch(() => ({})) as { keys?: EncryptionKey[]; error?: string }
    const jobsJson = await jobsRes.json().catch(() => ({})) as { jobs?: RotationJob[]; error?: string }

    if (!keysRes.ok || !jobsRes.ok) {
      setError(keysJson.error || jobsJson.error || "Failed to load encryption admin data.")
      setLoading(false)
      return
    }

    setKeys(keysJson.keys ?? [])
    setJobs(jobsJson.jobs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createKeyVersion = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingKey(true)
    setError("")
    setMessage("")

    const response = await fetch("/api/admin/encryption/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: keyNotes || undefined }),
    })

    const data = await response.json().catch(() => ({})) as { error?: string; key?: { key_version?: number } }

    if (!response.ok) {
      setError(data.error || "Unable to create key version.")
      setCreatingKey(false)
      return
    }

    setMessage(`Key version ${data.key?.key_version ?? "new"} is now active.`)
    setKeyNotes("")
    setCreatingKey(false)
    await loadData()
  }

  const createRotationJob = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingJob(true)
    setError("")
    setMessage("")

    const response = await fetch("/api/admin/encryption/rotation-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetTable,
        fromVersion: Number(fromVersion),
        toVersion: Number(toVersion),
      }),
    })

    const data = await response.json().catch(() => ({})) as { error?: string; job?: { id?: string } }

    if (!response.ok) {
      setError(data.error || "Unable to create rotation job.")
      setCreatingJob(false)
      return
    }

    setMessage(`Rotation job ${data.job?.id ?? "created"} added.`)
    setCreatingJob(false)
    await loadData()
  }

  const executeJob = async (jobId: string) => {
    setExecutingJobId(jobId)
    setError("")
    setMessage("")

    const response = await fetch(`/api/admin/encryption/rotation-jobs/${jobId}/execute`, {
      method: "POST",
    })

    const data = await response.json().catch(() => ({})) as {
      error?: string
      status?: string
      processedCount?: number
      manualRequiredCount?: number
    }

    if (!response.ok) {
      setError(data.error || "Failed to execute rotation job.")
      setExecutingJobId("")
      return
    }

    setMessage(
      `Job executed: ${data.status ?? "unknown"}. Auto-processed ${data.processedCount ?? 0}, manual ${data.manualRequiredCount ?? 0}.`
    )
    setExecutingJobId("")
    await loadData()
  }

  const activeVersion = keys.find((key) => key.status === "active")?.key_version ?? null

  return (
    <div className="section-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Encryption Governance</p>
        <h1 className="text-3xl font-bold text-safe-900">Key Versioning + Rotation Jobs</h1>
        <p className="text-safe-500 text-sm mt-1">
          Manage encryption key versions and run controlled rotation workflows with audit visibility.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {activeVersion && (
        <div className="alert-info">Current active key version: <strong>{activeVersion}</strong></div>
      )}

      <form className="card space-y-4" onSubmit={createKeyVersion}>
        <h2 className="text-lg font-semibold text-safe-900">Rotate to New Key Version</h2>
        <div>
          <label className="label">Rotation Notes</label>
          <input
            className="input"
            value={keyNotes}
            onChange={(event) => setKeyNotes(event.target.value)}
            placeholder="Example: Q2 security rotation"
          />
        </div>
        <button className="btn-primary" type="submit" disabled={creatingKey}>
          {creatingKey ? "Creating..." : "Create New Active Key Version"}
        </button>
      </form>

      <form className="card space-y-4" onSubmit={createRotationJob}>
        <h2 className="text-lg font-semibold text-safe-900">Create Rotation Job</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Target Table</label>
            <select className="input" value={targetTable} onChange={(event) => setTargetTable(event.target.value as RotationJob["target_table"])}>
              <option value="exchanges">exchanges</option>
              <option value="incident_reports">incident_reports</option>
              <option value="safety_entries">safety_entries</option>
              <option value="safety_plans">safety_plans</option>
            </select>
          </div>
          <div>
            <label className="label">From Version</label>
            <input className="input" inputMode="numeric" value={fromVersion} onChange={(event) => setFromVersion(event.target.value)} />
          </div>
          <div>
            <label className="label">To Version</label>
            <input className="input" inputMode="numeric" value={toVersion} onChange={(event) => setToVersion(event.target.value)} />
          </div>
        </div>
        <button className="btn-secondary" type="submit" disabled={creatingJob}>
          {creatingJob ? "Creating..." : "Create Rotation Job"}
        </button>
      </form>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-safe-900">Key Registry</h2>
        {loading ? (
          <p className="text-sm text-safe-500">Loading key registry…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-safe-500">No key versions recorded.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div key={key.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-safe-900">Version {key.key_version}</p>
                  <span className="badge-active capitalize">{key.status}</span>
                </div>
                <p className="text-xs text-safe-500 mt-1">
                  {key.algorithm} • Activated {new Date(key.activated_at).toLocaleString()}
                </p>
                {key.notes && <p className="text-sm text-safe-700 mt-2">{key.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-safe-900">Rotation Jobs</h2>
        {loading ? (
          <p className="text-sm text-safe-500">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-safe-500">No rotation jobs yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-safe-900">
                    {job.target_table}: v{job.from_version} to v{job.to_version}
                  </p>
                  <span className="badge-active capitalize">{job.status}</span>
                </div>
                <p className="text-xs text-safe-500">
                  Total {job.total_count} • Auto {job.processed_count} • Manual {job.manual_required_count} • Updated {new Date(job.updated_at).toLocaleString()}
                </p>
                {job.last_error && <p className="text-xs text-red-700">{job.last_error}</p>}
                <button
                  className="btn-ghost"
                  type="button"
                  disabled={executingJobId === job.id || !(job.status === "planned" || job.status === "failed" || job.status === "manual_required")}
                  onClick={() => executeJob(job.id)}
                >
                  {executingJobId === job.id ? "Executing..." : "Execute Job"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminEncryptionPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Checking encryption admin access…">
      <AdminEncryptionContent />
    </ProtectedRoute>
  )
}

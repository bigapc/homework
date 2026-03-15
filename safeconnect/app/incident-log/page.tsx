"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { decryptJson, encryptJson } from "@/lib/safetyCrypto"
import { getClientEncryptionKeyVersion } from "@/lib/encryptionVersion"

type IncidentReport = {
  id: string
  title: string
  severity: "low" | "medium" | "high" | "critical"
  details_encrypted: string
  details_iv: string
  details_salt: string
  created_at: string
}

function IncidentLogContent() {
  const encryptionKeyVersion = getClientEncryptionKeyVersion()
  const [passcode, setPasscode] = useState("")
  const [locked, setLocked] = useState(true)
  const [title, setTitle] = useState("")
  const [severity, setSeverity] = useState<IncidentReport["severity"]>("medium")
  const [details, setDetails] = useState("")
  const [rows, setRows] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    const user = await getCurrentUser()

    if (!user) {
      setLoading(false)
      setError("Please sign in again.")
      return
    }

    const { data, error: fetchError } = await supabase
      .from("incident_reports")
      .select("id,title,severity,details_encrypted,details_iv,details_salt,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data ?? []) as IncidentReport[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const createReport = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (passcode.length < 6) {
      setError("Use a passcode with at least 6 characters.")
      return
    }

    const user = await getCurrentUser()

    if (!user) {
      setError("Please sign in again.")
      return
    }

    setSaving(true)

    const encrypted = await encryptJson({ details }, passcode)

    const payload = {
      user_id: user.id,
      title,
      severity,
      details_encrypted: encrypted.cipherText,
      details_iv: encrypted.iv,
      details_salt: encrypted.salt,
      encryption_key_version: encryptionKeyVersion,
    }

    let { error: insertError } = await supabase.from("incident_reports").insert(payload)

    if (insertError?.message?.includes("encryption_key_version")) {
      const legacyPayload = {
        user_id: user.id,
        title,
        severity,
        details_encrypted: encrypted.cipherText,
        details_iv: encrypted.iv,
        details_salt: encrypted.salt,
      }
      const retry = await supabase.from("incident_reports").insert(legacyPayload)
      insertError = retry.error ?? null
    }

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setTitle("")
    setDetails("")
    setMessage("Incident logged with end-to-end encrypted details.")
    setSaving(false)
    await loadReports()
  }

  const unlockedRows = useMemo(() => {
    if (locked || passcode.length < 6) {
      return [] as Array<IncidentReport & { plainDetails: string }>
    }

    return rows
      .map((row) => {
        try {
          return {
            ...row,
            plainDetails: "",
          }
        } catch {
          return null
        }
      })
      .filter((item): item is IncidentReport & { plainDetails: string } => item !== null)
  }, [locked, passcode, rows])

  const decryptDetails = async (row: IncidentReport) => {
    try {
      const payload = await decryptJson<{ details: string }>(
        row.details_encrypted,
        passcode,
        row.details_iv,
        row.details_salt
      )
      return payload.details
    } catch {
      return "Unable to decrypt. Check your passcode."
    }
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Incident Log</p>
        <h1 className="text-3xl font-bold text-safe-900">Encrypted Incident Reporting</h1>
        <p className="text-safe-500 text-sm mt-1">Store sensitive events with encrypted detail fields for legal support and safety records.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-safe-900">Vault Passcode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="label">Encryption Passcode</label>
            <input
              className="input"
              type="password"
              placeholder="Enter incident vault passcode"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
          </div>
          <button className="btn-secondary" type="button" onClick={() => setLocked(false)}>
            Unlock
          </button>
          <button className="btn-ghost" type="button" onClick={() => setLocked(true)}>
            Lock
          </button>
        </div>
      </div>

      <form className="card space-y-4" onSubmit={createReport}>
        <h2 className="text-lg font-semibold text-safe-900">Report New Incident</h2>

        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Harassing message received" required />
        </div>

        <div>
          <label className="label">Severity</label>
          <select className="input" value={severity} onChange={(event) => setSeverity(event.target.value as IncidentReport["severity"])}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="label">Encrypted Details</label>
          <textarea
            className="input min-h-[120px]"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe exactly what happened. This field is encrypted before save."
            required
          />
        </div>

        <button className="btn-primary w-full" type="submit" disabled={saving}>
          {saving ? "Saving encrypted report..." : "Save Incident Report"}
        </button>
      </form>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-safe-900">Incident Timeline</h2>

        {loading ? (
          <p className="text-sm text-safe-500">Loading incidents…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-safe-500">No incidents logged yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <IncidentRow key={row.id} row={row} locked={locked} decrypt={decryptDetails} passcode={passcode} />
            ))}
          </div>
        )}

        {!locked && unlockedRows.length === 0 && passcode.length >= 6 && (
          <p className="text-xs text-safe-500">Reports will decrypt as you open each entry.</p>
        )}
      </div>
    </div>
  )
}

function IncidentRow({
  row,
  locked,
  passcode,
  decrypt,
}: {
  row: IncidentReport
  locked: boolean
  passcode: string
  decrypt: (row: IncidentReport) => Promise<string>
}) {
  const [plain, setPlain] = useState("")
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (locked) {
      setOpened(false)
      setPlain("")
    }
  }, [locked])

  const open = async () => {
    if (locked || passcode.length < 6) {
      return
    }

    const details = await decrypt(row)
    setPlain(details)
    setOpened(true)
  }

  return (
    <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-safe-900">{row.title}</p>
        <span className="badge-active capitalize">{row.severity}</span>
      </div>
      <p className="text-xs text-safe-400 mt-1">{new Date(row.created_at).toLocaleString()}</p>

      {opened ? (
        <p className="text-sm text-safe-700 mt-3 whitespace-pre-wrap">{plain}</p>
      ) : (
        <p className="text-sm text-safe-500 mt-3">
          {locked ? "Locked. Enter passcode and unlock to read details." : "Encrypted details hidden."}
        </p>
      )}

      {!opened && !locked && (
        <button className="btn-ghost mt-2" type="button" onClick={open}>
          Decrypt Details
        </button>
      )}
    </div>
  )
}

export default function IncidentLogPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Checking incident log access…">
      <IncidentLogContent />
    </ProtectedRoute>
  )
}

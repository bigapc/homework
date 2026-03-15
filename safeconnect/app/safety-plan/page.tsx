"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { decryptJson, encryptJson } from "@/lib/safetyCrypto"

type SafetyPlanRow = {
  id: string
  owner_id: string
  trusted_contact_email: string
  passcode_salt: string
  encrypted_payload: string
  iv: string
}

type SafetyEntryRow = {
  id: string
  plan_id: string
  owner_id: string
  entry_type: "abuse_log" | "protection_order_violation" | "recorded_message" | "court_note" | "other"
  occurred_at: string
  encrypted_note: string
  iv: string
  created_at: string
}

type DecryptedEntry = {
  id: string
  entry_type: SafetyEntryRow["entry_type"]
  occurred_at: string
  note: string
}

type VaultMarker = {
  marker: "SAFECONNECT_VAULT"
  createdAt: string
}

type SharePayloadEntry = {
  id: string
  entry_type: SafetyEntryRow["entry_type"]
  occurred_at: string
  encrypted_note: string
  iv: string
}

function generateShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let code = ""
  for (let i = 0; i < bytes.length; i += 1) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

export default function SafetyPlanPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [userId, setUserId] = useState("")
  const [plan, setPlan] = useState<SafetyPlanRow | null>(null)
  const [entries, setEntries] = useState<SafetyEntryRow[]>([])

  const [trustedContactEmail, setTrustedContactEmail] = useState("")
  const [passcode, setPasscode] = useState("")
  const [confirmPasscode, setConfirmPasscode] = useState("")

  const [unlockPasscode, setUnlockPasscode] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [activePasscode, setActivePasscode] = useState("")

  const [entryType, setEntryType] = useState<DecryptedEntry["entry_type"]>("abuse_log")
  const [entryNote, setEntryNote] = useState("")
  const [occurredAt, setOccurredAt] = useState("")

  const [saving, setSaving] = useState(false)
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([])
  const [oneTimeCode, setOneTimeCode] = useState("")

  const loadVault = useCallback(async () => {
    setLoading(true)
    setError("")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setLoading(false)
      router.push("/login")
      return
    }

    setUserId(user.id)

    const { data: planData, error: planError } = await supabase
      .from("safety_plans")
      .select("id,owner_id,trusted_contact_email,passcode_salt,encrypted_payload,iv")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (planError) {
      setError(planError.message)
      setPlan(null)
      setEntries([])
      setLoading(false)
      return
    }

    if (!planData) {
      setPlan(null)
      setEntries([])
      setLoading(false)
      return
    }

    setPlan(planData as SafetyPlanRow)
    setTrustedContactEmail((planData as SafetyPlanRow).trusted_contact_email)

    const { data: entryRows, error: entryError } = await supabase
      .from("safety_entries")
      .select("id,plan_id,owner_id,entry_type,occurred_at,encrypted_note,iv,created_at")
      .eq("plan_id", (planData as SafetyPlanRow).id)
      .order("occurred_at", { ascending: false })

    if (entryError) {
      setError(entryError.message)
      setEntries([])
      setLoading(false)
      return
    }

    setEntries((entryRows ?? []) as SafetyEntryRow[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadVault()
  }, [loadVault])

  useEffect(() => {
    const run = async () => {
      if (!plan || !isUnlocked || !activePasscode) {
        setDecryptedEntries([])
        return
      }

      const result: DecryptedEntry[] = []

      for (const row of entries) {
        try {
          const payload = await decryptJson<{ note: string }>(
            row.encrypted_note,
            activePasscode,
            row.iv,
            plan.passcode_salt
          )

          result.push({
            id: row.id,
            entry_type: row.entry_type,
            occurred_at: row.occurred_at,
            note: payload.note,
          })
        } catch {
          result.push({
            id: row.id,
            entry_type: row.entry_type,
            occurred_at: row.occurred_at,
            note: "Unable to decrypt this entry with current passcode.",
          })
        }
      }

      setDecryptedEntries(result)
    }

    run()
  }, [entries, plan, isUnlocked, activePasscode])

  const createVault = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    if (!trustedContactEmail.trim()) {
      setError("Trusted contact email is required.")
      setSaving(false)
      return
    }

    if (passcode.length < 6) {
      setError("Passcode must be at least 6 characters.")
      setSaving(false)
      return
    }

    if (passcode !== confirmPasscode) {
      setError("Passcodes do not match.")
      setSaving(false)
      return
    }

    const marker = {
      marker: "SAFECONNECT_VAULT",
      createdAt: new Date().toISOString(),
    } as VaultMarker

    const encrypted = await encryptJson(marker, passcode)

    const { error: insertError } = await supabase.from("safety_plans").insert({
      owner_id: userId,
      trusted_contact_email: trustedContactEmail.trim(),
      passcode_salt: encrypted.salt,
      encrypted_payload: encrypted.cipherText,
      iv: encrypted.iv,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setNotice("Safety Plan box created.")
    setPasscode("")
    setConfirmPasscode("")
    setSaving(false)
    await loadVault()
  }

  const unlockVault = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setNotice("")

    if (!plan) {
      return
    }

    try {
      const payload = await decryptJson<VaultMarker>(
        plan.encrypted_payload,
        unlockPasscode,
        plan.iv,
        plan.passcode_salt
      )

      if (payload.marker !== "SAFECONNECT_VAULT") {
        setError("Invalid passcode.")
        return
      }

      setIsUnlocked(true)
      setActivePasscode(unlockPasscode)
      setUnlockPasscode("")
      setNotice("Safety box unlocked.")
    } catch {
      setError("Invalid passcode.")
    }
  }

  const saveTrustedContact = async () => {
    if (!plan) {
      return
    }

    setError("")
    setNotice("")
    setSaving(true)

    const { error: updateError } = await supabase
      .from("safety_plans")
      .update({ trusted_contact_email: trustedContactEmail.trim() })
      .eq("id", plan.id)
      .eq("owner_id", userId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setNotice("Trusted contact updated.")
    setSaving(false)
    await loadVault()
  }

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!plan || !isUnlocked || !activePasscode) {
      setError("Unlock the safety box first.")
      return
    }

    if (!entryNote.trim()) {
      setError("Entry text is required.")
      return
    }

    setSaving(true)
    setError("")
    setNotice("")

    const encrypted = await encryptJson(
      { note: entryNote.trim() },
      activePasscode,
      plan.passcode_salt
    )

    const { error: insertError } = await supabase.from("safety_entries").insert({
      plan_id: plan.id,
      owner_id: userId,
      entry_type: entryType,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      encrypted_note: encrypted.cipherText,
      iv: encrypted.iv,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setEntryNote("")
    setOccurredAt("")
    setNotice("Entry securely logged.")
    setSaving(false)
    await loadVault()
  }

  const generateOneTimeShare = async () => {
    if (!plan || !isUnlocked || !activePasscode) {
      setError("Unlock the safety box first.")
      return
    }

    if (entries.length === 0) {
      setError("Add at least one entry before generating a share code.")
      return
    }

    setSaving(true)
    setError("")
    setNotice("")

    const shareCode = generateShareCode()
    const entriesPayload: SharePayloadEntry[] = entries.map((entry) => ({
      id: entry.id,
      entry_type: entry.entry_type,
      occurred_at: entry.occurred_at,
      encrypted_note: entry.encrypted_note,
      iv: entry.iv,
    }))

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from("safety_share_packets").insert({
      plan_id: plan.id,
      owner_id: userId,
      trusted_contact_email: plan.trusted_contact_email,
      share_code: shareCode,
      passcode_salt: plan.passcode_salt,
      verifier_ciphertext: plan.encrypted_payload,
      verifier_iv: plan.iv,
      entries_payload: entriesPayload,
      expires_at: expiresAt,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setOneTimeCode(shareCode)
    setNotice("One-time share code created. Share this code and your passcode only with your trusted person.")
    setSaving(false)
  }

  const typeLabel = useMemo<Record<DecryptedEntry["entry_type"], string>>(
    () => ({
      abuse_log: "Abuse Log",
      protection_order_violation: "Protection Order Violation",
      recorded_message: "Recorded Message Note",
      court_note: "Court Note",
      other: "Other",
    }),
    []
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Safety Plan Section</h1>
      <p className="text-sm text-gray-700">
        This private digital safety box is encrypted with your passcode. Use it to log abuse incidents,
        violations, messages, and court-related notes securely.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <p className="text-green-700 text-sm">{notice}</p>}

      {loading ? (
        <div className="bg-white shadow-md rounded-xl p-6">Loading safety box...</div>
      ) : !plan ? (
        <form onSubmit={createVault} className="bg-white shadow-md rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create Your Safety Box</h2>
          <p className="text-sm text-gray-600">
            Set one trusted contact email and a private passcode to lock your digital log.
          </p>
          <input
            type="email"
            className="w-full border p-2 rounded"
            placeholder="Trusted contact email (one person)"
            value={trustedContactEmail}
            onChange={(e) => setTrustedContactEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Create passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Confirm passcode"
            value={confirmPasscode}
            onChange={(e) => setConfirmPasscode(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Safety Box"}
          </button>
        </form>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Safety Box Access</h2>
            {!isUnlocked ? (
              <form onSubmit={unlockVault} className="space-y-3">
                <input
                  type="password"
                  className="w-full border p-2 rounded"
                  placeholder="Enter passcode to unlock"
                  value={unlockPasscode}
                  onChange={(e) => setUnlockPasscode(e.target.value)}
                  required
                />
                <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded">
                  Unlock Safety Box
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-green-700 text-sm">Safety box unlocked.</p>
                <button
                  type="button"
                  className="bg-gray-200 px-4 py-2 rounded"
                  onClick={() => {
                    setIsUnlocked(false)
                    setActivePasscode("")
                    setDecryptedEntries([])
                  }}
                >
                  Lock Safety Box
                </button>
              </div>
            )}
          </div>

          <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Trusted Person</h2>
            <p className="text-sm text-gray-600">
              Only one trusted person can be listed for emergency sharing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                className="w-full border p-2 rounded"
                value={trustedContactEmail}
                onChange={(e) => setTrustedContactEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={saveTrustedContact}
                disabled={saving}
                className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">One-Time Emergency Share</h2>
            <p className="text-sm text-gray-600">
              Generate a one-time code for your trusted person. They can open it once at /safety-plan/share using
              the code and your safety passcode.
            </p>
            <button
              type="button"
              onClick={generateOneTimeShare}
              disabled={saving || !isUnlocked}
              className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Generating..." : "Generate One-Time Share Code"}
            </button>
            {oneTimeCode && (
              <div className="border rounded p-3 bg-gray-50">
                <p className="text-sm">
                  One-time code: <strong>{oneTimeCode}</strong>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Expires in 24 hours or after the first successful open.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={addEntry} className="bg-white shadow-md rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Add Secure Log Entry</h2>
            <select
              className="w-full border p-2 rounded"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as DecryptedEntry["entry_type"])}
            >
              <option value="abuse_log">Abuse Log</option>
              <option value="protection_order_violation">Protection Order Violation</option>
              <option value="recorded_message">Recorded Message Note</option>
              <option value="court_note">Court Note</option>
              <option value="other">Other</option>
            </select>
            <input
              type="datetime-local"
              className="w-full border p-2 rounded"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
            <textarea
              className="w-full border p-2 rounded min-h-36"
              placeholder="Write what happened. Keep details factual (date/time/location/what was said or done)."
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={saving || !isUnlocked}
              className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Encrypted Entry"}
            </button>
          </form>

          <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Encrypted Log Timeline</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-600">No entries yet.</p>
            ) : !isUnlocked ? (
              <p className="text-sm text-gray-600">Unlock your safety box to read your entries.</p>
            ) : (
              <div className="space-y-3">
                {decryptedEntries.map((entry) => (
                  <div key={entry.id} className="border rounded p-3 bg-gray-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{typeLabel[entry.entry_type]}</p>
                      <p className="text-xs text-gray-600">{new Date(entry.occurred_at).toLocaleString()}</p>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{entry.note}</p>
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

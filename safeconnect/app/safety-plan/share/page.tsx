"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { decryptJson } from "@/lib/safetyCrypto"

type SharedEncryptedEntry = {
  id: string
  entry_type: "abuse_log" | "protection_order_violation" | "recorded_message" | "court_note" | "other"
  occurred_at: string
  encrypted_note: string
  iv: string
}

type SharedDecryptedEntry = {
  id: string
  entry_type: SharedEncryptedEntry["entry_type"]
  occurred_at: string
  note: string
}

type SharedPacket = {
  trusted_contact_email: string
  passcode_salt: string
  verifier_ciphertext: string
  verifier_iv: string
  entries_payload: SharedEncryptedEntry[]
  expires_at: string
  created_at: string
}

const typeLabel: Record<SharedEncryptedEntry["entry_type"], string> = {
  abuse_log: "Abuse Log",
  protection_order_violation: "Protection Order Violation",
  recorded_message: "Recorded Message Note",
  court_note: "Court Note",
  other: "Other",
}

export default function SafetySharePage() {
  const [shareCode, setShareCode] = useState("")
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<SharedDecryptedEntry[]>([])

  const openOneTimeShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setNotice("")
    setEntries([])

    const { data, error: fetchError } = await supabase.rpc("fetch_one_time_safety_share", {
      p_share_code: shareCode.trim(),
    })

    if (fetchError || !data) {
      setError(fetchError?.message || "Invalid or expired code.")
      setLoading(false)
      return
    }

    const packet = data as SharedPacket

    try {
      const marker = await decryptJson<{ marker: string }>(
        packet.verifier_ciphertext,
        passcode,
        packet.verifier_iv,
        packet.passcode_salt
      )

      if (marker.marker !== "SAFECONNECT_VAULT") {
        throw new Error("Invalid passcode")
      }

      const decryptedEntries: SharedDecryptedEntry[] = []

      for (const entry of packet.entries_payload ?? []) {
        const payload = await decryptJson<{ note: string }>(
          entry.encrypted_note,
          passcode,
          entry.iv,
          packet.passcode_salt
        )

        decryptedEntries.push({
          id: entry.id,
          entry_type: entry.entry_type,
          occurred_at: entry.occurred_at,
          note: payload.note,
        })
      }

      const { data: marked, error: markError } = await supabase.rpc("mark_one_time_safety_share_used", {
        p_share_code: shareCode.trim(),
      })

      if (markError || !marked) {
        setError(markError?.message || "Code is already used or expired.")
        setLoading(false)
        return
      }

      setEntries(decryptedEntries)
      setNotice(
        `One-time share opened for trusted contact ${packet.trusted_contact_email}. This code is now locked.`
      )
    } catch {
      setError("Invalid passcode for this safety share.")
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Safety Plan One-Time Access</h1>
      <p className="text-sm text-gray-700">
        Enter the one-time code and safety passcode provided by the plan holder.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <p className="text-green-700 text-sm">{notice}</p>}

      <form onSubmit={openOneTimeShare} className="bg-white shadow-md rounded-xl p-6 space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="One-time share code"
          value={shareCode}
          onChange={(e) => setShareCode(e.target.value.toUpperCase())}
          required
        />
        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Safety passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Opening..." : "Open One-Time Share"}
        </button>
      </form>

      {entries.length > 0 && (
        <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Decrypted Safety Log</h2>
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="border rounded p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{typeLabel[entry.entry_type]}</p>
                  <p className="text-xs text-gray-600">{new Date(entry.occurred_at).toLocaleString()}</p>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{entry.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

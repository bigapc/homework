"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"

type JournalEntry = {
  id: string
  entry_date: string
  entry_type: "journal" | "calendar" | "email_log" | "case_note" | "reminder"
  title: string
  body: string | null
  contact_name: string | null
  contact_method: string | null
  email_to: string | null
  email_subject: string | null
  reminder_at: string | null
  status: "open" | "done" | "archived"
  created_at: string
}

const typeLabels: Record<JournalEntry["entry_type"], string> = {
  journal: "Journal",
  calendar: "Calendar",
  email_log: "Email Log",
  case_note: "Case Note",
  reminder: "Reminder",
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function JournalCenterContent() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [form, setForm] = useState({
    entry_date: todayIso(),
    entry_type: "journal" as JournalEntry["entry_type"],
    title: "",
    body: "",
    contact_name: "",
    contact_method: "",
    email_to: "",
    email_subject: "",
    reminder_at: "",
  })

  const openCount = useMemo(() => entries.filter((entry) => entry.status === "open").length, [entries])
  const reminderCount = useMemo(() => entries.filter((entry) => entry.entry_type === "reminder" && entry.status === "open").length, [entries])

  const loadEntries = useCallback(async () => {
    setError("")
    const { data, error: loadError } = await supabase
      .from("client_journal_entries")
      .select("id,entry_date,entry_type,title,body,contact_name,contact_method,email_to,email_subject,reminder_at,status,created_at")
      .neq("status", "archived")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setEntries((data ?? []) as JournalEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError("Please sign in again before saving an entry.")
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from("client_journal_entries").insert({
      user_id: authData.user.id,
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      title: form.title,
      body: form.body || null,
      contact_name: form.contact_name || null,
      contact_method: form.contact_method || null,
      email_to: form.email_to || null,
      email_subject: form.email_subject || null,
      reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setMessage("Entry saved to your Journal Center.")
    setForm({
      entry_date: todayIso(),
      entry_type: "journal",
      title: "",
      body: "",
      contact_name: "",
      contact_method: "",
      email_to: "",
      email_subject: "",
      reminder_at: "",
    })
    setSaving(false)
    await loadEntries()
  }

  async function updateStatus(id: string, status: JournalEntry["status"]) {
    const { error: updateError } = await supabase
      .from("client_journal_entries")
      .update({ status })
      .eq("id", id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, status } : entry))
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Survivor Portal</p>
          <h1 className="text-3xl font-bold text-safe-900">Safety Box Journal Center</h1>
          <p className="text-sm text-safe-500 mt-1">Calendar notes, journal entries, contact logs, and private reminders in one secure place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/request" className="btn-secondary text-sm px-4 py-2">Back to Requests</Link>
          <Link href="/notifications" className="btn-primary text-sm px-4 py-2">Notifications</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-xs text-safe-500">Open entries</p><p className="text-2xl font-bold text-safe-900">{openCount}</p></div>
        <div className="card"><p className="text-xs text-safe-500">Active reminders</p><p className="text-2xl font-bold text-safe-900">{reminderCount}</p></div>
        <div className="card"><p className="text-xs text-safe-500">Total visible</p><p className="text-2xl font-bold text-safe-900">{entries.length}</p></div>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}
      {message ? <div className="alert-success">{message}</div> : null}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-warm-600">New Entry</p>
          <h2 className="text-xl font-bold text-safe-900">Add calendar note, journal log, or reminder</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.entry_date} onChange={(event) => setForm((prev) => ({ ...prev, entry_date: event.target.value }))} required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.entry_type} onChange={(event) => setForm((prev) => ({ ...prev, entry_type: event.target.value as JournalEntry["entry_type"] }))}>
              <option value="journal">Journal</option>
              <option value="calendar">Calendar</option>
              <option value="email_log">Email Log</option>
              <option value="case_note">Case Note</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          <div>
            <label className="label">Reminder time optional</label>
            <input className="input" type="datetime-local" value={form.reminder_at} onChange={(event) => setForm((prev) => ({ ...prev, reminder_at: event.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Example: Follow up with front desk" required />
        </div>

        <div>
          <label className="label">Journal note / directive / log</label>
          <textarea className="input min-h-[110px] resize-y" value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} placeholder="Add private notes, gate directions, contact attempts, schedule details, or safety reminders." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Contact name optional</label>
            <input className="input" value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} placeholder="Front desk, landlord, advocate..." />
          </div>
          <div>
            <label className="label">Contact method optional</label>
            <input className="input" value={form.contact_method} onChange={(event) => setForm((prev) => ({ ...prev, contact_method: event.target.value }))} placeholder="Phone, email, office, text..." />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email to optional</label>
            <input className="input" type="email" value={form.email_to} onChange={(event) => setForm((prev) => ({ ...prev, email_to: event.target.value }))} placeholder="name@example.com" />
          </div>
          <div>
            <label className="label">Email subject optional</label>
            <input className="input" value={form.email_subject} onChange={(event) => setForm((prev) => ({ ...prev, email_subject: event.target.value }))} placeholder="Subject line to log" />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving entry..." : "Save to Safety Box"}
        </button>
      </form>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-safe-900">Recent Safety Box Entries</h2>
          <button type="button" onClick={loadEntries} className="text-xs font-medium text-safe-600 hover:text-safe-900 underline">Refresh</button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-safe-400">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-sm text-safe-500">No entries saved yet.</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-safe-100 bg-safe-50/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-safe-900">{entry.title}</h3>
                      <span className="badge-active">{typeLabels[entry.entry_type]}</span>
                      <span className={entry.status === "done" ? "badge-done" : "badge-pending"}>{entry.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-safe-400">{new Date(entry.entry_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.status !== "done" ? <button type="button" onClick={() => updateStatus(entry.id, "done")} className="btn-secondary text-xs px-3 py-2">Mark Done</button> : null}
                    <button type="button" onClick={() => updateStatus(entry.id, "archived")} className="btn-secondary text-xs px-3 py-2">Archive</button>
                  </div>
                </div>
                {entry.body ? <p className="mt-3 whitespace-pre-wrap text-sm text-safe-700">{entry.body}</p> : null}
                <div className="mt-3 grid gap-1 text-xs text-safe-500 sm:grid-cols-2">
                  {entry.contact_name ? <p><span className="font-semibold text-safe-700">Contact:</span> {entry.contact_name}</p> : null}
                  {entry.contact_method ? <p><span className="font-semibold text-safe-700">Method:</span> {entry.contact_method}</p> : null}
                  {entry.email_to ? <p><span className="font-semibold text-safe-700">Email:</span> {entry.email_to}</p> : null}
                  {entry.email_subject ? <p><span className="font-semibold text-safe-700">Subject:</span> {entry.email_subject}</p> : null}
                  {entry.reminder_at ? <p><span className="font-semibold text-safe-700">Reminder:</span> {new Date(entry.reminder_at).toLocaleString()}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JournalCenterPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Opening Safety Box Journal Center...">
      <JournalCenterContent />
    </ProtectedRoute>
  )
}

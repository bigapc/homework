"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type DispatchAlert = {
  id: string
  exchange_id: string | null
  template: string
  status: string
  priority: string | null
  sound_key: string | null
  acknowledged_at: string | null
  created_at: string
  payload: Record<string, unknown> | null
}

function labelFor(template: string) {
  if (template === "large_exchange_request") return "Large Exchange Request"
  if (template === "courier_assignment") return "Courier Assignment"
  if (template === "new_exchange_request") return "New Exchange Request"
  return template.replace(/_/g, " ")
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : "-"
}

function playDispatcherBeep(kind?: string | null) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const context = new Ctx()
    const now = context.currentTime
    const freqs = kind === "large_exchange" ? [392, 523, 392] : [660, 880]
    freqs.forEach((freq, index) => {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const start = now + index * 0.16
      osc.frequency.value = freq
      osc.type = "sine"
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(start)
      osc.stop(start + 0.14)
    })
  } catch {
    // Browser audio may be blocked until user interaction.
  }
}

export default function DispatcherAlertPanel() {
  const [alerts, setAlerts] = useState<DispatchAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [error, setError] = useState("")

  const unacknowledgedCount = useMemo(
    () => alerts.filter((alert) => !alert.acknowledged_at).length,
    [alerts]
  )

  async function loadAlerts() {
    setError("")
    const { data, error: loadError } = await supabase
      .from("notification_events")
      .select("id,exchange_id,template,status,priority,sound_key,acknowledged_at,created_at,payload")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(10)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setAlerts((data ?? []) as DispatchAlert[])
    setLoading(false)
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel("apc-dispatch-alert-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification_events" },
        (payload) => {
          const row = payload.new as DispatchAlert
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 10))
          if (soundEnabled) playDispatcherBeep(row.sound_key)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [soundEnabled])

  async function acknowledgeAlert(id: string) {
    const { error: updateError } = await supabase
      .from("notification_events")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setAlerts((current) => current.filter((alert) => alert.id !== id))
  }

  function enableSound() {
    setSoundEnabled(true)
    playDispatcherBeep("standard_request")
  }

  return (
    <section className="mb-6 rounded-3xl border border-red-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">APC Dispatcher Alerts</p>
          <h2 className="text-2xl font-bold text-slate-950">Live request notification center</h2>
          <p className="text-sm text-slate-600">
            Unacknowledged alerts: <span className="font-bold text-red-700">{unacknowledgedCount}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={enableSound} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
            {soundEnabled ? "Sound On" : "Enable Sound"}
          </button>
          <button type="button" onClick={loadAlerts} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Loading dispatcher alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No live alerts waiting.</div>
        ) : (
          alerts.map((alert) => (
            <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{labelFor(alert.template)}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Request #{shortId(alert.exchange_id)} • {alert.priority ?? "normal"}</p>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Live</span>
              </div>
              {alert.payload?.pickup ? <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Pickup:</span> {String(alert.payload.pickup)}</p> : null}
              {alert.payload?.dropoff ? <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Dropoff:</span> {String(alert.payload.dropoff)}</p> : null}
              <p className="mt-2 text-xs text-slate-500">Created {new Date(alert.created_at).toLocaleString()}</p>
              <button type="button" onClick={() => acknowledgeAlert(alert.id)} className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                Acknowledge
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

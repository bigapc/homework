"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type OperationRow = {
  id: string
  request_code: string
  status: string
  payment_status: string
  proof_status: string
  proof_package_complete: boolean
  survivor_email: string | null
  courier_email: string | null
  pickup: string | null
  dropoff: string | null
  quoted_total_usd: number | null
  latest_tracking_status: string | null
  latest_tracking_at: string | null
  dropoff_completed_at: string | null
  created_at: string
}

function money(value: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function badgeClass(value: string) {
  if (["paid", "completed", "complete", "delivered"].includes(value)) return "bg-green-100 text-green-800"
  if (["assigned", "in_transit", "picked_up", "queued"].includes(value)) return "bg-blue-100 text-blue-800"
  if (["pending", "unpaid", "partial"].includes(value)) return "bg-amber-100 text-amber-800"
  if (["canceled", "failed"].includes(value)) return "bg-red-100 text-red-800"
  return "bg-slate-100 text-slate-700"
}

export default function AdminOperationsSummary() {
  const [rows, setRows] = useState<OperationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => ["assigned", "in_transit", "picked_up"].includes(row.status)).length,
      paid: rows.filter((row) => row.payment_status === "paid").length,
      completed: rows.filter((row) => row.status === "completed").length,
      proofComplete: rows.filter((row) => row.proof_package_complete).length,
    }
  }, [rows])

  async function loadRows() {
    setError("")
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("safeconnect_exchange_operations_summary")
      .select("id,request_code,status,payment_status,proof_status,proof_package_complete,survivor_email,courier_email,pickup,dropoff,quoted_total_usd,latest_tracking_status,latest_tracking_at,dropoff_completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(15)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setRows((data ?? []) as OperationRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadRows()
  }, [])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">APC Operations Summary</p>
          <h2 className="text-2xl font-bold text-slate-950">SafeConnect request command view</h2>
          <p className="text-sm text-slate-600">Payment, proof, courier, tracking, and completion status in one admin view.</p>
        </div>
        <button type="button" onClick={loadRows} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          Refresh Summary
        </button>
      </div>

      {error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold text-slate-950">{metrics.total}</p></div>
        <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs text-blue-700">Active</p><p className="text-2xl font-bold text-blue-950">{metrics.active}</p></div>
        <div className="rounded-2xl bg-green-50 p-4"><p className="text-xs text-green-700">Paid</p><p className="text-2xl font-bold text-green-950">{metrics.paid}</p></div>
        <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs text-amber-700">Proof Complete</p><p className="text-2xl font-bold text-amber-950">{metrics.proofComplete}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Completed</p><p className="text-2xl font-bold text-slate-950">{metrics.completed}</p></div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Loading operations summary...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No request records found.</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Proof</th>
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2">Courier</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-950">#{row.request_code}</p>
                    <p className="text-xs text-slate-500">{row.survivor_email ?? "No survivor"}</p>
                    <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{row.pickup}</p>
                  </td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(row.status)}`}>{row.status}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(row.payment_status)}`}>{row.payment_status}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(row.proof_status)}`}>{row.proof_package_complete ? "complete" : row.proof_status}</span></td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(row.latest_tracking_status ?? "none")}`}>{row.latest_tracking_status ?? "none"}</span>
                    {row.latest_tracking_at ? <p className="mt-1 text-xs text-slate-500">{new Date(row.latest_tracking_at).toLocaleString()}</p> : null}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.courier_email ?? "Unassigned"}</td>
                  <td className="px-3 py-3 font-bold text-slate-950">{money(row.quoted_total_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
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

type ProofRecord = {
  id: string
  exchange_id: string
  proof_type: string
  signer_name: string | null
  storage_bucket: string | null
  storage_path: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
}

function badgeClass(value?: string | null) {
  if (!value) return "bg-slate-100 text-slate-700"
  if (["paid", "completed", "complete", "delivered"].includes(value)) return "bg-green-100 text-green-800"
  if (["assigned", "in_transit", "picked_up", "queued"].includes(value)) return "bg-blue-100 text-blue-800"
  if (["pending", "unpaid", "partial"].includes(value)) return "bg-amber-100 text-amber-800"
  if (["canceled", "failed"].includes(value)) return "bg-red-100 text-red-800"
  return "bg-slate-100 text-slate-700"
}

function money(value: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function isPhotoProof(proofType: string) {
  return proofType === "pickup_photo" || proofType === "dropoff_photo"
}

function AdminProofViewerContent() {
  const [requests, setRequests] = useState<OperationRow[]>([])
  const [proofs, setProofs] = useState<ProofRecord[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [proofLoading, setProofLoading] = useState(false)
  const [error, setError] = useState("")

  const selected = useMemo(() => requests.find((row) => row.id === selectedId) ?? requests[0] ?? null, [requests, selectedId])

  const loadRequests = useCallback(async () => {
    setError("")
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("safeconnect_exchange_operations_summary")
      .select("id,request_code,status,payment_status,proof_status,proof_package_complete,survivor_email,courier_email,pickup,dropoff,quoted_total_usd,latest_tracking_status,latest_tracking_at,dropoff_completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as OperationRow[]
    setRequests(rows)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
    setLoading(false)
  }, [selectedId])

  const loadProofs = useCallback(async (exchangeId: string) => {
    setProofLoading(true)
    setError("")
    setSignedUrls({})

    const { data, error: proofError } = await supabase
      .from("exchange_service_proofs")
      .select("id,exchange_id,proof_type,signer_name,storage_bucket,storage_path,latitude,longitude,notes,created_at")
      .eq("exchange_id", exchangeId)
      .order("created_at", { ascending: true })

    if (proofError) {
      setError(proofError.message)
      setProofLoading(false)
      return
    }

    const rows = (data ?? []) as ProofRecord[]
    setProofs(rows)

    const urlPairs = await Promise.all(
      rows
        .filter((proof) => isPhotoProof(proof.proof_type) && proof.storage_bucket && proof.storage_path)
        .map(async (proof) => {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(proof.storage_bucket as string)
            .createSignedUrl(proof.storage_path as string, 60 * 10)

          if (signedError || !signedData?.signedUrl) {
            return null
          }

          return [proof.id, signedData.signedUrl] as const
        })
    )

    setSignedUrls(Object.fromEntries(urlPairs.filter(Boolean) as [string, string][]))
    setProofLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (selected?.id) {
      loadProofs(selected.id)
    } else {
      setProofs([])
      setSignedUrls({})
    }
  }, [selected?.id, loadProofs])

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Admin Console</p>
          <h1 className="text-3xl font-bold text-safe-900">Proof Viewer</h1>
          <p className="text-sm text-safe-500 mt-1">Review payment, courier, GPS, signatures, proof records, and secure photo previews.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dispatcher" className="btn-secondary text-sm px-4 py-2">Dispatcher</Link>
          <button type="button" onClick={loadRequests} className="btn-primary text-sm px-4 py-2">Refresh</button>
        </div>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="card space-y-4">
          <h2 className="text-lg font-bold text-safe-900">Requests</h2>
          {loading ? (
            <p className="text-sm text-safe-500">Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-safe-500">No requests found.</p>
          ) : (
            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
              {requests.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${selected?.id === row.id ? "border-warm-400 bg-warm-50" : "border-safe-100 bg-safe-50/40 hover:bg-safe-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-safe-900">#{row.request_code}</p>
                      <p className="text-xs text-safe-500">{row.survivor_email ?? "No survivor"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(row.status)}`}>{row.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${badgeClass(row.payment_status)}`}>{row.payment_status}</span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${badgeClass(row.proof_status)}`}>{row.proof_package_complete ? "proof complete" : row.proof_status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          {!selected ? (
            <div className="card text-sm text-safe-500">Select a request to view proof details.</div>
          ) : (
            <>
              <div className="card space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-safe-500">Request</p>
                    <h2 className="text-2xl font-bold text-safe-900">#{selected.request_code}</h2>
                    <p className="text-sm text-safe-500">Created {new Date(selected.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(selected.status)}`}>{selected.status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(selected.payment_status)}`}>{selected.payment_status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(selected.proof_status)}`}>{selected.proof_package_complete ? "proof complete" : selected.proof_status}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-safe-50 p-4"><p className="text-xs text-safe-500">Total</p><p className="text-xl font-bold text-safe-900">{money(selected.quoted_total_usd)}</p></div>
                  <div className="rounded-2xl bg-safe-50 p-4"><p className="text-xs text-safe-500">Courier</p><p className="text-sm font-bold text-safe-900 break-all">{selected.courier_email ?? "Unassigned"}</p></div>
                  <div className="rounded-2xl bg-safe-50 p-4"><p className="text-xs text-safe-500">Tracking</p><p className="text-sm font-bold text-safe-900">{selected.latest_tracking_status ?? "none"}</p></div>
                  <div className="rounded-2xl bg-safe-50 p-4"><p className="text-xs text-safe-500">Completed</p><p className="text-sm font-bold text-safe-900">{selected.dropoff_completed_at ? new Date(selected.dropoff_completed_at).toLocaleString() : "Not completed"}</p></div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p><span className="font-semibold text-safe-900">Survivor:</span> {selected.survivor_email ?? "No survivor"}</p>
                  <p><span className="font-semibold text-safe-900">Latest tracking:</span> {selected.latest_tracking_at ? new Date(selected.latest_tracking_at).toLocaleString() : "No tracking"}</p>
                  <p><span className="font-semibold text-safe-900">Pickup:</span> {selected.pickup}</p>
                  <p><span className="font-semibold text-safe-900">Dropoff:</span> {selected.dropoff}</p>
                </div>
              </div>

              <div className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-safe-900">Proof Records</h2>
                    <p className="text-xs text-safe-500">Private photo previews expire after a short signed access window.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadProofs(selected.id)} className="btn-secondary text-xs px-3 py-2">Refresh Proofs</button>
                    <Link href={`/track/${selected.id}`} className="btn-secondary text-xs px-3 py-2">Open Tracking Page</Link>
                  </div>
                </div>
                {proofLoading ? (
                  <p className="text-sm text-safe-500">Loading proof records...</p>
                ) : proofs.length === 0 ? (
                  <p className="text-sm text-safe-500">No proof records saved for this request yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {proofs.map((proof) => (
                      <article key={proof.id} className="rounded-2xl border border-safe-100 bg-safe-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-safe-900 capitalize">{proof.proof_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-safe-400">{new Date(proof.created_at).toLocaleString()}</p>
                          </div>
                          <span className="badge-done">Saved</span>
                        </div>

                        {signedUrls[proof.id] ? (
                          <a
                            href={signedUrls[proof.id]}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block overflow-hidden rounded-2xl border border-safe-100 bg-white shadow-sm"
                          >
                            <img
                              src={signedUrls[proof.id]}
                              alt={`${proof.proof_type.replace(/_/g, " ")} proof preview`}
                              className="h-52 w-full object-cover"
                            />
                            <span className="block px-3 py-2 text-xs font-semibold text-safe-700">Open full secure image</span>
                          </a>
                        ) : isPhotoProof(proof.proof_type) && proof.storage_path ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                            Photo saved. Preview unavailable until signed access refreshes.
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-1 text-xs text-safe-600">
                          {proof.signer_name ? <p><span className="font-semibold text-safe-800">Signer:</span> {proof.signer_name}</p> : null}
                          {proof.storage_path ? <p className="break-all"><span className="font-semibold text-safe-800">File:</span> {proof.storage_path}</p> : null}
                          {proof.latitude != null && proof.longitude != null ? <p><span className="font-semibold text-safe-800">GPS:</span> {proof.latitude}, {proof.longitude}</p> : null}
                          {proof.notes ? <p><span className="font-semibold text-safe-800">Notes:</span> {proof.notes}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default function AdminProofsPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Opening proof viewer...">
      <AdminProofViewerContent />
    </ProtectedRoute>
  )
}

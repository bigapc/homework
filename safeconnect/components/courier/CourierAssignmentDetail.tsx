"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type AssignmentDetail = {
  id: string
  pickup: string
  dropoff: string
  status: string
  created_at: string
  items?: string | null
  vehicle_type?: string | null
}

type CourierAction = "accept" | "picked_up" | "start_tracking" | "delivered"
type ProofType = "pickup_photo" | "pickup_signature" | "dropoff_photo" | "dropoff_signature"

type ServiceProof = {
  id: string
  proof_type: ProofType
  signer_name: string | null
  storage_path: string | null
  created_at: string
}

const PROOF_BUCKET = "safeconnect-private-documents"

const REQUIRED_PROOFS: { type: ProofType; label: string }[] = [
  { type: "pickup_photo", label: "Pickup photo" },
  { type: "pickup_signature", label: "Pickup signature" },
  { type: "dropoff_photo", label: "Drop-off photo" },
  { type: "dropoff_signature", label: "Drop-off signature" },
]

function isSignatureProof(type: ProofType) {
  return type === "pickup_signature" || type === "dropoff_signature"
}

function isPhotoProof(type: ProofType) {
  return type === "pickup_photo" || type === "dropoff_photo"
}

async function getCurrentCoords() {
  return new Promise<{ latitude: number; longitude: number } | undefined>((resolve) => {
    if (!navigator.geolocation) {
      resolve(undefined)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    )
  })
}

export default function CourierAssignmentDetail({ assignment }: { assignment: AssignmentDetail }) {
  const [currentStatus, setCurrentStatus] = useState(assignment.status)
  const [loadingAction, setLoadingAction] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [proofs, setProofs] = useState<ServiceProof[]>([])
  const [signerNames, setSignerNames] = useState<Record<string, string>>({})
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})
  const [savingProof, setSavingProof] = useState("")

  const proofMap = useMemo(() => {
    return proofs.reduce<Record<string, ServiceProof>>((acc, proof) => {
      acc[proof.proof_type] = proof
      return acc
    }, {})
  }, [proofs])

  const proofComplete = REQUIRED_PROOFS.every((proof) => Boolean(proofMap[proof.type]))

  async function loadProofs() {
    const { data, error: proofError } = await supabase
      .from("exchange_service_proofs")
      .select("id,proof_type,signer_name,storage_path,created_at")
      .eq("exchange_id", assignment.id)
      .order("created_at", { ascending: false })

    if (proofError) {
      setError(proofError.message)
      return
    }

    setProofs((data ?? []) as ServiceProof[])
  }

  useEffect(() => {
    loadProofs()
  }, [assignment.id])

  async function uploadProofFile(proofType: ProofType, file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const cleanExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg"
    const storagePath = `exchange-proofs/${assignment.id}/${proofType}-${Date.now()}.${cleanExtension}`

    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      })

    if (uploadError) throw uploadError
    return storagePath
  }

  async function saveProof(proofType: ProofType) {
    setSavingProof(proofType)
    setMessage("")
    setError("")

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      setError("Please sign in again before saving proof.")
      setSavingProof("")
      return
    }

    const signerName = signerNames[proofType]?.trim() || null
    if (isSignatureProof(proofType) && !signerName) {
      setError("Enter the signer name before saving this proof.")
      setSavingProof("")
      return
    }

    const file = selectedFiles[proofType]
    if (isPhotoProof(proofType) && !file) {
      setError("Choose or take a photo before saving this proof.")
      setSavingProof("")
      return
    }

    try {
      const coords = await getCurrentCoords()
      const storagePath = file ? await uploadProofFile(proofType, file) : null

      const { error: insertError } = await supabase.from("exchange_service_proofs").insert({
        exchange_id: assignment.id,
        courier_id: authData.user.id,
        proof_type: proofType,
        signer_name: signerName,
        storage_bucket: storagePath ? PROOF_BUCKET : null,
        storage_path: storagePath,
        signature_payload: isSignatureProof(proofType)
          ? JSON.stringify({ method: "typed_signature", signerName, signedAt: new Date().toISOString() })
          : null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        notes: storagePath
          ? `${proofType.replace(/_/g, " ")} photo uploaded by courier.`
          : `${proofType.replace(/_/g, " ")} confirmed by courier.`,
      })

      if (insertError) throw insertError

      setSignerNames((prev) => ({ ...prev, [proofType]: "" }))
      setSelectedFiles((prev) => ({ ...prev, [proofType]: null }))
      setMessage(`${proofType.replace(/_/g, " ")} saved.`)
      await loadProofs()
    } catch (proofError) {
      const detail = proofError instanceof Error ? proofError.message : "Unable to save proof."
      setError(detail)
    } finally {
      setSavingProof("")
    }
  }

  async function runAction(action: CourierAction) {
    if (action === "delivered" && !proofComplete) {
      setError("All proof records are required before delivery can be completed.")
      return
    }

    setLoadingAction(action)
    setMessage("")
    setError("")

    const coords = action === "start_tracking" || action === "delivered" ? await getCurrentCoords() : undefined

    const response = await fetch(`/api/courier/assignments/${assignment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...coords }),
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string }

    if (!response.ok) {
      setError(payload.error || "Unable to update assignment.")
      setLoadingAction("")
      return
    }

    if (payload.status) {
      setCurrentStatus(payload.status)
    }

    setMessage(`Action complete: ${action.replace(/_/g, " ")}.`)
    setLoadingAction("")
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Courier Assignment</p>
          <h1 className="text-3xl font-bold text-safe-900">Assignment #{assignment.id.slice(0, 8).toUpperCase()}</h1>
          <p className="mt-2 text-safe-600">Created {new Date(assignment.created_at).toLocaleString()}</p>
        </div>
        <Link href="/courier/assignments" className="btn-secondary text-sm px-4 py-2">
          Back to Assignments
        </Link>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}
      {message ? <div className="alert-success">{message}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <p className="text-lg font-semibold text-slate-900 capitalize">{currentStatus.replace(/_/g, " ")}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 capitalize">{assignment.vehicle_type || "standard"}</span>
        </div>

        <div><p className="text-xs uppercase tracking-wider text-slate-500">Pickup</p><p className="text-slate-900 font-medium">{assignment.pickup}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-slate-500">Dropoff</p><p className="text-slate-900 font-medium">{assignment.dropoff}</p></div>
        {assignment.items ? <div><p className="text-xs uppercase tracking-wider text-slate-500">Items</p><p className="text-slate-700 whitespace-pre-wrap">{assignment.items}</p></div> : null}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Proof of Service</p>
          <h2 className="text-xl font-semibold text-slate-900">Pickup and drop-off proof package</h2>
          <p className="text-sm text-slate-700">Upload photos and confirm signatures before marking the assignment delivered.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {REQUIRED_PROOFS.map((proof) => {
            const saved = proofMap[proof.type]
            const signature = isSignatureProof(proof.type)
            const photo = isPhotoProof(proof.type)
            return (
              <div key={proof.type} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{proof.label}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${saved ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                    {saved ? "Saved" : "Needed"}
                  </span>
                </div>
                {photo ? (
                  <div className="mt-4 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={Boolean(saved) || savingProof !== ""}
                      onChange={(event) => setSelectedFiles((prev) => ({ ...prev, [proof.type]: event.target.files?.[0] ?? null }))}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    {selectedFiles[proof.type] ? <p className="text-xs text-slate-500">Ready: {selectedFiles[proof.type]?.name}</p> : null}
                  </div>
                ) : null}
                {signature ? (
                  <input
                    className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Signer full name"
                    value={signerNames[proof.type] ?? ""}
                    onChange={(event) => setSignerNames((prev) => ({ ...prev, [proof.type]: event.target.value }))}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => saveProof(proof.type)}
                  disabled={savingProof !== "" || Boolean(saved)}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingProof === proof.type ? "Saving..." : saved ? "Saved" : `Save ${proof.label}`}
                </button>
                {saved ? <p className="mt-3 text-xs text-slate-500">Saved {new Date(saved.created_at).toLocaleString()}{saved.signer_name ? ` by ${saved.signer_name}` : ""}</p> : null}
              </div>
            )
          })}
        </div>

        <div className={`rounded-2xl px-4 py-3 text-sm ${proofComplete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {proofComplete ? "Proof package complete. Delivery may be marked delivered." : "Proof package incomplete. Complete all four proof records before marking delivered."}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Workflow Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => runAction("accept")} disabled={loadingAction !== ""} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loadingAction === "accept" ? "Saving..." : "Accept Assignment"}</button>
          <button type="button" onClick={() => runAction("picked_up")} disabled={loadingAction !== ""} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{loadingAction === "picked_up" ? "Saving..." : "Mark Picked Up"}</button>
          <button type="button" onClick={() => runAction("start_tracking")} disabled={loadingAction !== ""} className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{loadingAction === "start_tracking" ? "Saving..." : "Start Tracking"}</button>
          <button type="button" onClick={() => runAction("delivered")} disabled={loadingAction !== "" || !proofComplete} className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50">{loadingAction === "delivered" ? "Saving..." : "Mark Delivered"}</button>
        </div>
        <p className="text-sm text-slate-600">Start Tracking captures your current GPS point. Delivery completion requires payment and the proof package.</p>
      </div>
    </div>
  )
}

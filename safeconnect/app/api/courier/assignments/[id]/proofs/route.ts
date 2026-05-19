import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"

type ProofType = "pickup_photo" | "pickup_signature" | "dropoff_photo" | "dropoff_signature"

const ALLOWED_PROOF_TYPES: ProofType[] = [
  "pickup_photo",
  "pickup_signature",
  "dropoff_photo",
  "dropoff_signature",
]

function isProofType(value: unknown): value is ProofType {
  return typeof value === "string" && ALLOWED_PROOF_TYPES.includes(value as ProofType)
}

function isSignatureProof(value: ProofType) {
  return value === "pickup_signature" || value === "dropoff_signature"
}

function getProofSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authorization = request.headers.get("authorization")

  if (!url || !anonKey) {
    return null
  }

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return getServerRouteSupabase()
}

async function requireCourier(request: Request) {
  const supabase = getProofSupabase(request)

  if (!supabase) {
    return { supabase: null, userId: null, error: "Supabase route client unavailable.", status: 503 }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, userId: null, error: "Unauthorized", status: 401 }
  }

  const { data: roleRow } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (roleRow?.role !== "courier") {
    return { supabase, userId: user.id, error: "Courier access required.", status: 403 }
  }

  return { supabase, userId: user.id, error: null as string | null, status: 200 }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireCourier(request)

  if (auth.error || !auth.supabase || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const exchangeId = context.params.id

  if (!exchangeId) {
    return NextResponse.json({ error: "Assignment id is required." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    proofType?: unknown
    signerName?: unknown
    storageBucket?: unknown
    storagePath?: unknown
    latitude?: unknown
    longitude?: unknown
  }

  if (!isProofType(body.proofType)) {
    return NextResponse.json({ error: "Invalid proof type." }, { status: 400 })
  }

  const proofType = body.proofType
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : ""
  const storageBucket = typeof body.storageBucket === "string" ? body.storageBucket : null
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : null
  const latitude = typeof body.latitude === "number" ? body.latitude : null
  const longitude = typeof body.longitude === "number" ? body.longitude : null

  if (isSignatureProof(proofType) && !signerName) {
    return NextResponse.json({ error: "Signer name is required for signature proofs." }, { status: 400 })
  }

  const { data: exchange, error: exchangeError } = await auth.supabase
    .from("exchanges")
    .select("id,courier_id")
    .eq("id", exchangeId)
    .eq("courier_id", auth.userId)
    .single()

  if (exchangeError || !exchange) {
    return NextResponse.json({ error: "Assignment not found for this courier." }, { status: 404 })
  }

  const { data: existing } = await auth.supabase
    .from("exchange_service_proofs")
    .select("id")
    .eq("exchange_id", exchangeId)
    .eq("courier_id", auth.userId)
    .eq("proof_type", proofType)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({ error: `${proofType.replace(/_/g, " ")} has already been saved.` }, { status: 409 })
  }

  const { data: proofRow, error: insertError } = await auth.supabase
    .from("exchange_service_proofs")
    .insert({
      exchange_id: exchangeId,
      courier_id: auth.userId,
      proof_type: proofType,
      signer_name: signerName || null,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      signature_payload: isSignatureProof(proofType)
        ? JSON.stringify({ method: "typed_signature", signerName, signedAt: new Date().toISOString() })
        : null,
      latitude,
      longitude,
      notes: storagePath
        ? `${proofType.replace(/_/g, " ")} photo uploaded by courier.`
        : `${proofType.replace(/_/g, " ")} confirmed by courier.`,
    })
    .select("id,proof_type,signer_name,storage_path,created_at")
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, proof: proofRow })
}

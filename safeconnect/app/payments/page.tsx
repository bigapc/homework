"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
}

type ExchangePayment = {
  id: string
  exchange_id: string
  amount_cents: number
  currency: string
  status: "pending" | "paid" | "failed" | "refunded"
  created_at: string
}

function PaymentsPageContent() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState("")
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [payments, setPayments] = useState<ExchangePayment[]>([])
  const [selectedExchangeId, setSelectedExchangeId] = useState("")
  const [amount, setAmount] = useState("49")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const user = await getCurrentUser()

    if (!user) {
      setLoading(false)
      setError("Please sign in again.")
      return
    }

    setUserId(user.id)

    const [{ data: exchangeRows, error: exchangeError }, { data: paymentRows, error: paymentError }] = await Promise.all([
      supabase
        .from("exchanges")
        .select("id,pickup,dropoff,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("exchange_payments")
        .select("id,exchange_id,amount_cents,currency,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ])

    if (exchangeError || paymentError) {
      setError(exchangeError?.message || paymentError?.message || "Unable to load payment data.")
      setLoading(false)
      return
    }

    const safeExchanges = (exchangeRows ?? []) as Exchange[]
    setExchanges(safeExchanges)
    setPayments((paymentRows ?? []) as ExchangePayment[])

    if (!selectedExchangeId && safeExchanges.length > 0) {
      setSelectedExchangeId(safeExchanges[0].id)
    }

    setLoading(false)
  }, [selectedExchangeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const status = searchParams.get("status")
    if (status === "success") {
      setMessage("Payment completed successfully.")
    }
    if (status === "cancelled") {
      setMessage("Checkout was cancelled.")
    }
  }, [searchParams])

  const selectedExchange = useMemo(
    () => exchanges.find((item) => item.id === selectedExchangeId) ?? null,
    [exchanges, selectedExchangeId]
  )

  const createPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setMessage("")

    if (!selectedExchangeId) {
      setError("Choose an exchange before continuing.")
      setSubmitting(false)
      return
    }

    const amountCents = Math.round(Number(amount) * 100)

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter a valid payment amount.")
      setSubmitting(false)
      return
    }

    const idempotencyKey = crypto.randomUUID()

    const response = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        exchangeId: selectedExchangeId,
        amountCents,
      }),
    })

    const data = await response.json().catch(() => ({}) as Record<string, string>)

    if (!response.ok) {
      setMessage("Payment record created. Checkout is unavailable until Stripe keys are configured.")
      setSubmitting(false)
      await loadData()
      return
    }

    if (typeof data.url === "string" && data.url.length > 0) {
      window.location.href = data.url
      return
    }

    setMessage("Checkout session created, but no redirect URL was returned.")
    setSubmitting(false)
    await loadData()
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Payments</p>
        <h1 className="text-3xl font-bold text-safe-900">Secure Checkout</h1>
        <p className="text-safe-500 text-sm mt-1">Create a payment session for a specific exchange request.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-info">{message}</div>}

      <form className="card space-y-4" onSubmit={createPayment}>
        <h2 className="text-lg font-semibold text-safe-900">New Payment</h2>

        {loading ? (
          <p className="text-sm text-safe-500">Loading your exchanges…</p>
        ) : (
          <>
            <div>
              <label className="label">Exchange</label>
              <select
                className="input"
                value={selectedExchangeId}
                onChange={(event) => setSelectedExchangeId(event.target.value)}
              >
                {exchanges.map((exchange) => (
                  <option value={exchange.id} key={exchange.id}>
                    #{exchange.id.slice(0, 8).toUpperCase()} - {exchange.pickup} to {exchange.dropoff}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Amount (USD)</label>
              <input
                className="input"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="49.00"
              />
            </div>

            {selectedExchange && (
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 text-sm text-safe-700">
                Paying for exchange #{selectedExchange.id.slice(0, 8).toUpperCase()} ({selectedExchange.status})
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting || loading}>
              {submitting ? "Preparing checkout..." : "Continue to Stripe Checkout"}
            </button>
          </>
        )}
      </form>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-safe-900">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-safe-500">No payments yet.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-safe-900">
                    ${ (payment.amount_cents / 100).toFixed(2) } {payment.currency.toUpperCase()}
                  </p>
                  <span className="badge-active capitalize">{payment.status}</span>
                </div>
                <p className="text-xs text-safe-500 mt-1">
                  Exchange #{payment.exchange_id.slice(0, 8).toUpperCase()} • {new Date(payment.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Checking payments access…">
      <PaymentsPageContent />
    </ProtectedRoute>
  )
}

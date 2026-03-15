"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Courier = {
  id: string
  email: string
}

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  status: string
  created_at: string
  user_id: string
  courier_id: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [pendingExchanges, setPendingExchanges] = useState<Exchange[]>([])
  const [assigningId, setAssigningId] = useState("")
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({})

  const loadAdminData = useCallback(async () => {
    setError("")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      router.push("/login")
      return
    }

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (meError) {
      setError(meError.message)
      setReady(true)
      return
    }

    if (!me || me.role !== "admin") {
      setError("Admin access required.")
      setReady(true)
      return
    }

    const [{ data: courierRows, error: courierError }, { data: exchangeRows, error: exchangeError }] = await Promise.all([
      supabase.from("users").select("id,email").eq("role", "courier").order("email", { ascending: true }),
      supabase
        .from("exchanges")
        .select("id,pickup,dropoff,status,created_at,user_id,courier_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ])

    if (courierError || exchangeError) {
      setError(courierError?.message || exchangeError?.message || "Failed to load admin data")
      setReady(true)
      return
    }

    setCouriers((courierRows ?? []) as Courier[])
    setPendingExchanges((exchangeRows ?? []) as Exchange[])
    setReady(true)
  }, [router])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  const assignCourier = async (exchangeId: string) => {
    const courierId = selectedCourier[exchangeId]

    if (!courierId) {
      setError("Please choose a courier before assigning.")
      return
    }

    setAssigningId(exchangeId)
    setError("")
    setNotice("")

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({ courier_id: courierId, status: "assigned" })
      .eq("id", exchangeId)

    if (updateError) {
      setError(updateError.message)
      setAssigningId("")
      return
    }

    setPendingExchanges((prev) => prev.filter((row) => row.id !== exchangeId))
    setNotice("Courier assigned successfully.")
    setAssigningId("")
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Admin Assignment Portal</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <p className="text-green-700 text-sm">{notice}</p>}

      {!ready ? (
        <div className="bg-white shadow-md rounded-xl p-6">Loading admin data...</div>
      ) : pendingExchanges.length === 0 ? (
        <div className="bg-white shadow-md rounded-xl p-6">No pending exchanges to assign.</div>
      ) : (
        <div className="space-y-4">
          {pendingExchanges.map((exchange) => (
            <div key={exchange.id} className="bg-white shadow-md rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-semibold">Request #{exchange.id.slice(0, 8)}</h2>
              <p><strong>Pickup:</strong> {exchange.pickup}</p>
              <p><strong>Dropoff:</strong> {exchange.dropoff}</p>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <select
                  className="border rounded p-2 min-w-60"
                  value={selectedCourier[exchange.id] ?? ""}
                  onChange={(e) =>
                    setSelectedCourier((prev) => ({
                      ...prev,
                      [exchange.id]: e.target.value,
                    }))
                  }
                >
                  <option value="">Select courier</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.email}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={assigningId === exchange.id || couriers.length === 0}
                  onClick={() => assignCourier(exchange.id)}
                  className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {assigningId === exchange.id ? "Assigning..." : "Assign Courier"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

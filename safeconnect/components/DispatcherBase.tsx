"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { exchangeQuoteSelectFields, isMissingExchangeQuoteColumnsError } from "@/lib/exchangeQuote"
import { geocodeAddress } from "@/lib/openStreetMap"

type Courier = {
  id: string
  email: string
}

type NearbyCourier = {
  courier_id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  vehicle_type: string
  rating: number | null
  total_deliveries: number
  distance_miles: number
  status: string
}

type LlmCopilotSuggestion = {
  summary: string
  reasoning: string
  recommended_user_id: string | null
  sms_draft: string
}

type Exchange = {
  id: string
  user_id: string
  courier_id: string | null
  pickup: string
  dropoff: string
  status: "pending" | "assigned" | "completed"
  created_at: string
  vehicle_type: "standard" | "premium" | "xl"
  service_window_mode: "asap" | "scheduled" | null
  requested_service_at: string | null
  quoted_distance_miles: number | null
  quoted_duration_minutes: number | null
  quoted_total_cents: number | null
  courier_payout_cents?: number | null
  quoted_is_after_hours: boolean
  quoted_is_weekend: boolean
  quoted_is_high_risk: boolean
}

type DispatchEvent = {
  id: string
  exchange_id: string
  event_type: "assigned" | "reassigned" | "status_changed" | "note"
  note: string | null
  created_at: string
}

type FinancialStatementEntry = {
  id: string
  date: string
  category: "commercial" | "rideshare" | "uhaul" | "rental_car" | "movers" | "emergency_fund"
  direction: "in" | "out"
  amount: number
  note: string
}

type SupportingDocItem = {
  id: string
  label: string
  checked: boolean
  group: "tax" | "partnership" | "rideshare" | "uhaul" | "movers"
}

const DEFAULT_SUPPORTING_DOCS: SupportingDocItem[] = [
  { id: "tax-1099", label: "1099 / year-end tax summary export", checked: false, group: "tax" },
  { id: "tax-receipts", label: "Commercial service receipts bundle", checked: false, group: "tax" },
  { id: "partnership-statement", label: "Partnership financial statement", checked: false, group: "partnership" },
  { id: "rideshare-ledger", label: "Rideshare emergency trip ledger (LYF, UBR, TXI)", checked: false, group: "rideshare" },
  { id: "uhaul-invoice", label: "U-Haul / rental car invoices", checked: false, group: "uhaul" },
  { id: "movers-invoice", label: "Mover company invoices + supplies add-ons", checked: false, group: "movers" },
]

type DispatcherBaseProps = {
  title?: string
  productName?: string
  subtitle?: string
}

export default function DispatcherBase({
  title = "SafeConnect Dispatcher Base",
  productName = "Powered by Armstrong Pack Company",
  subtitle = "Secure dispatch command center for staff and courier coordination.",
}: DispatcherBaseProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [events, setEvents] = useState<DispatchEvent[]>([])
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({})
  const [nearbyCouriers, setNearbyCouriers] = useState<Record<string, NearbyCourier[]>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState("")
  const [lookupId, setLookupId] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [financialEntries, setFinancialEntries] = useState<FinancialStatementEntry[]>([])
  const [emergencyFundBalance, setEmergencyFundBalance] = useState(5000)
  const [supportingDocs, setSupportingDocs] = useState<SupportingDocItem[]>([])
  const [entryForm, setEntryForm] = useState({
    category: "commercial" as FinancialStatementEntry["category"],
    direction: "in" as FinancialStatementEntry["direction"],
    amount: "",
    note: "",
  })
  const [statementStartDate, setStatementStartDate] = useState("")
  const [statementEndDate, setStatementEndDate] = useState("")
  const [copiedDraftExchangeId, setCopiedDraftExchangeId] = useState("")
  const [copilotLoadingExchangeId, setCopilotLoadingExchangeId] = useState("")
  const [llmSuggestions, setLlmSuggestions] = useState<Record<string, LlmCopilotSuggestion>>({})
  const llmCopilotEnabled = process.env.NEXT_PUBLIC_ENABLE_LLM_COPILOT === "1"
  const [copilotMode, setCopilotMode] = useState<"heuristic" | "llm">(llmCopilotEnabled ? "llm" : "heuristic")

  const loadFinancialData = useCallback(async () => {
    const [entriesRes, docsRes, settingRes] = await Promise.all([
      supabase
        .from("dispatcher_financial_entries")
        .select("id,created_at,category,direction,amount_cents,note")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("dispatcher_supporting_docs")
        .select("doc_key,label,doc_group,checked")
        .order("created_at", { ascending: true }),
      supabase
        .from("dispatcher_financial_settings")
        .select("numeric_value")
        .eq("setting_key", "emergency_fund_balance_cents")
        .maybeSingle(),
    ])

    const firstError = entriesRes.error || docsRes.error || settingRes.error
    if (firstError) {
      if (
        firstError.message.includes("relation") &&
        firstError.message.includes("does not exist")
      ) {
        setError("Dispatcher finance tables are not migrated yet. Apply Supabase migration 023_dispatcher_financial_tracking.sql.")
      } else {
        setError(firstError.message)
      }
      return
    }

    setFinancialEntries(
      (entriesRes.data ?? []).map((entry) => ({
        id: entry.id,
        date: entry.created_at,
        category: entry.category,
        direction: entry.direction,
        amount: (entry.amount_cents ?? 0) / 100,
        note: entry.note ?? "",
      })) as FinancialStatementEntry[]
    )

    if ((docsRes.data ?? []).length === 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const defaultRows = DEFAULT_SUPPORTING_DOCS.map((doc) => ({
        doc_key: doc.id,
        label: doc.label,
        doc_group: doc.group,
        checked: doc.checked,
        updated_by: user?.id ?? null,
      }))

      const { error: seedError } = await supabase
        .from("dispatcher_supporting_docs")
        .upsert(defaultRows, { onConflict: "doc_key" })

      if (seedError) {
        setError(seedError.message)
      } else {
        setSupportingDocs(DEFAULT_SUPPORTING_DOCS)
      }
    } else {
      setSupportingDocs(
        (docsRes.data ?? []).map((doc) => ({
          id: doc.doc_key,
          label: doc.label,
          group: doc.doc_group,
          checked: doc.checked,
        })) as SupportingDocItem[]
      )
    }

    if (settingRes.data?.numeric_value != null) {
      setEmergencyFundBalance(Number(settingRes.data.numeric_value) / 100)
    }
  }, [])

  const mapVehicleType = (vehicleType: Exchange["vehicle_type"]) => {
    if (vehicleType === "xl") {
      return "van"
    }

    return "car"
  }

  const findNearby = async (exchange: Exchange) => {
    setLookupId(exchange.id)
    setError("")
    setMessage("")

    try {
      const coords = await geocodeAddress(exchange.pickup)
      const response = await fetch("/api/dispatcher/nearby-couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_lat: coords.lat,
          pickup_lng: coords.lng,
          vehicle_type: mapVehicleType(exchange.vehicle_type),
          max_distance_miles: 50,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        couriers?: NearbyCourier[]
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch nearby couriers.")
      }

      const matches = payload.couriers ?? []
      setNearbyCouriers((prev) => ({ ...prev, [exchange.id]: matches }))

      if (matches[0]) {
        setSelectedCourier((prev) => ({ ...prev, [exchange.id]: matches[0].user_id }))
      }

      setMessage(matches.length ? `Found ${matches.length} nearby courier matches.` : "No nearby couriers found.")
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Unable to look up nearby couriers.")
    } finally {
      setLookupId("")
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [courierRes, exchangeRes, eventRes] = await Promise.all([
      supabase.from("users").select("id,email").eq("role", "courier").order("email", { ascending: true }),
      supabase
        .from("exchanges")
        .select(`id,user_id,courier_id,pickup,dropoff,status,created_at,vehicle_type,${exchangeQuoteSelectFields}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("dispatch_events")
        .select("id,exchange_id,event_type,note,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    let safeExchangeData: unknown = exchangeRes.data
    let safeExchangeError = exchangeRes.error

    if (safeExchangeError && isMissingExchangeQuoteColumnsError(safeExchangeError.message)) {
      const fallbackExchangeRes = await supabase
        .from("exchanges")
        .select("id,user_id,courier_id,pickup,dropoff,status,created_at,vehicle_type")
        .order("created_at", { ascending: false })
        .limit(50)

      safeExchangeData = fallbackExchangeRes.data
      safeExchangeError = fallbackExchangeRes.error
    }

    if (courierRes.error || safeExchangeError || eventRes.error) {
      setError(courierRes.error?.message || safeExchangeError?.message || eventRes.error?.message || "Unable to load dispatch data.")
      setLoading(false)
      return
    }

    setCouriers((courierRes.data ?? []) as Courier[])
    setExchanges(((safeExchangeData ?? []) as unknown[]) as Exchange[])
    setEvents((eventRes.data ?? []) as DispatchEvent[])
    await loadFinancialData()
    setLoading(false)
  }, [loadFinancialData])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addFinancialEntry = async () => {
    const amount = Number(entryForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Financial statement amount must be greater than zero.")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error: insertError } = await supabase
      .from("dispatcher_financial_entries")
      .insert({
        created_by: user?.id ?? null,
        category: entryForm.category,
        direction: entryForm.direction,
        amount_cents: Math.round(amount * 100),
        note: entryForm.note.trim() || null,
      })
      .select("id,created_at,category,direction,amount_cents,note")
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    const newEntry: FinancialStatementEntry = {
      id: data.id,
      date: data.created_at,
      category: data.category,
      direction: data.direction,
      amount: (data.amount_cents ?? 0) / 100,
      note: data.note ?? "",
    }

    setFinancialEntries((prev) => [newEntry, ...prev])
    setEntryForm({
      category: "commercial",
      direction: "in",
      amount: "",
      note: "",
    })
    setMessage("Financial statement entry recorded.")
    setError("")
  }

  const toggleSupportingDoc = async (docId: string) => {
    const current = supportingDocs.find((doc) => doc.id === docId)
    if (!current) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const nextChecked = !current.checked
    const { error: updateError } = await supabase
      .from("dispatcher_supporting_docs")
      .update({
        checked: nextChecked,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("doc_key", docId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSupportingDocs((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, checked: nextChecked } : doc))
    )
  }

  const saveEmergencyFundBaseline = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: upsertError } = await supabase
      .from("dispatcher_financial_settings")
      .upsert(
        {
          setting_key: "emergency_fund_balance_cents",
          numeric_value: Math.round(emergencyFundBalance * 100),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: "setting_key" }
      )

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setMessage("Emergency fund baseline saved.")
  }

  const assignCourier = async (exchange: Exchange) => {
    const courierId = selectedCourier[exchange.id]

    if (!courierId) {
      setError("Choose a courier first.")
      return
    }

    setWorkingId(exchange.id)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({
        courier_id: courierId,
        status: "assigned",
      })
      .eq("id", exchange.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingId("")
      return
    }

    if (adminId) {
      await supabase.from("dispatch_events").insert({
        exchange_id: exchange.id,
        admin_id: adminId,
        courier_id: courierId,
        event_type: exchange.courier_id ? "reassigned" : "assigned",
        note: exchange.courier_id ? "Courier reassigned by dispatch base." : "Courier assigned by dispatch base.",
      })
    }

    if (courierId) {
      await supabase.from("notification_events").insert({
        user_id: courierId,
        exchange_id: exchange.id,
        channel: "sms",
        recipient: "pending-courier-number",
        template: "courier_assignment",
        payload: {
          exchangeId: exchange.id,
          pickup: exchange.pickup,
          dropoff: exchange.dropoff,
        },
      })
    }

    setMessage("Dispatch updated successfully.")
    setWorkingId("")
    await loadData()
  }

  const updateStatus = async (exchange: Exchange, nextStatus: Exchange["status"]) => {
    setWorkingId(exchange.id)
    setError("")
    setMessage("")

    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData.user?.id

    const { error: updateError } = await supabase
      .from("exchanges")
      .update({ status: nextStatus })
      .eq("id", exchange.id)

    if (updateError) {
      setError(updateError.message)
      setWorkingId("")
      return
    }

    if (adminId) {
      await supabase.from("dispatch_events").insert({
        exchange_id: exchange.id,
        admin_id: adminId,
        courier_id: exchange.courier_id,
        event_type: "status_changed",
        note: `Status changed to ${nextStatus}.`,
      })
    }

    setMessage("Exchange status updated.")
    setWorkingId("")
    await loadData()
  }

  const getDispatchSummary = (exchange: Exchange) => {
    if (copilotMode === "llm" && llmSuggestions[exchange.id]?.summary) {
      return llmSuggestions[exchange.id].summary
    }

    const createdAt = new Date(exchange.created_at)
    const ageMinutes = Math.max(1, Math.round((Date.now() - createdAt.getTime()) / 60000))
    const timingLabel =
      exchange.service_window_mode === "scheduled" && exchange.requested_service_at
        ? `Scheduled for ${new Date(exchange.requested_service_at).toLocaleString()}`
        : "ASAP service"

    const riskFlags: string[] = []
    if (exchange.quoted_is_high_risk) riskFlags.push("high-risk")
    if (exchange.quoted_is_after_hours) riskFlags.push("after-hours")
    if (exchange.quoted_is_weekend) riskFlags.push("weekend")

    const riskText = riskFlags.length ? riskFlags.join(", ") : "standard risk"
    const distanceText = exchange.quoted_distance_miles
      ? `${exchange.quoted_distance_miles} mi / ${exchange.quoted_duration_minutes ?? 0} min`
      : "distance pending"

    return `${timingLabel} • ${distanceText} • ${riskText} • created ${ageMinutes} min ago`
  }

  const getCopilotReasoning = (exchange: Exchange) => {
    if (copilotMode === "llm" && llmSuggestions[exchange.id]?.reasoning) {
      return llmSuggestions[exchange.id].reasoning
    }

    return "Heuristic mode ranks couriers by distance, rating, delivery history, and risk-sensitive fit."
  }

  const courierScore = (courier: NearbyCourier, exchange: Exchange) => {
    const distanceScore = Math.max(0, 100 - courier.distance_miles * 2)
    const ratingScore = (courier.rating ?? 0) * 15
    const deliveryScore = Math.min(100, courier.total_deliveries) * 0.25
    const statusBonus = courier.status.toLowerCase().includes("active") ? 10 : 0
    const riskPenalty = exchange.quoted_is_high_risk && (courier.rating ?? 0) < 4.6 ? 15 : 0
    return distanceScore + ratingScore + deliveryScore + statusBonus - riskPenalty
  }

  const getRecommendedNearbyCourier = (exchange: Exchange) => {
    if (copilotMode === "llm") {
      const suggestedUserId = llmSuggestions[exchange.id]?.recommended_user_id
      if (suggestedUserId) {
        const nearby = nearbyCouriers[exchange.id] ?? []
        const llmCourier = nearby.find((courier) => courier.user_id === suggestedUserId)
        if (llmCourier) {
          return llmCourier
        }
      }
    }

    const nearby = nearbyCouriers[exchange.id] ?? []
    if (!nearby.length) {
      return null
    }

    return [...nearby]
      .sort((a, b) => courierScore(b, exchange) - courierScore(a, exchange))[0]
  }

  const requestLlmSuggestion = async (exchange: Exchange) => {
    if (!llmCopilotEnabled) {
      setError("LLM copilot is disabled. Set NEXT_PUBLIC_ENABLE_LLM_COPILOT=1.")
      return null
    }

    const nearby = nearbyCouriers[exchange.id] ?? []
    if (!nearby.length) {
      setError("Run Find Nearby first so AI can evaluate active courier options.")
      return null
    }

    setCopilotLoadingExchangeId(exchange.id)
    setError("")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch("/api/dispatcher/copilot", {
        method: "POST",
        headers,
        body: JSON.stringify({
          exchange,
          nearbyCouriers: nearby,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        suggestion?: LlmCopilotSuggestion
      }

      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error || "Unable to generate AI copilot suggestion.")
      }

      setLlmSuggestions((prev) => ({
        ...prev,
        [exchange.id]: payload.suggestion!,
      }))
      setMessage("AI copilot suggestion generated.")
      return payload.suggestion
    } catch (copilotError) {
      setError(copilotError instanceof Error ? copilotError.message : "Unable to generate AI copilot suggestion.")
      return null
    } finally {
      setCopilotLoadingExchangeId("")
    }
  }

  const applyCourierRecommendation = async (exchange: Exchange) => {
    if (copilotMode === "llm" && !llmSuggestions[exchange.id]) {
      const suggestion = await requestLlmSuggestion(exchange)
      if (!suggestion) {
        return
      }
    }

    const recommendation = getRecommendedNearbyCourier(exchange)
    if (!recommendation) {
      setError("Run Find Nearby first to generate a recommendation.")
      return
    }

    setSelectedCourier((prev) => ({
      ...prev,
      [exchange.id]: recommendation.user_id,
    }))
    setMessage(`AI recommendation selected: ${recommendation.first_name} ${recommendation.last_name} (${recommendation.distance_miles.toFixed(1)} mi).`)
    setError("")
  }

  const getCourierSmsDraft = (exchange: Exchange) => {
    if (copilotMode === "llm" && llmSuggestions[exchange.id]?.sms_draft) {
      return llmSuggestions[exchange.id].sms_draft
    }

    const recommendation = getRecommendedNearbyCourier(exchange)
    const courierName = recommendation
      ? `${recommendation.first_name} ${recommendation.last_name}`
      : "selected courier"
    const eta = exchange.quoted_duration_minutes ? `${exchange.quoted_duration_minutes} min` : "TBD"

    return [
      `SafeConnect Dispatch Alert - Exchange ${exchange.id.slice(0, 8).toUpperCase()}`,
      `Assignment target: ${courierName}`,
      `Pickup: ${exchange.pickup}`,
      `Dropoff: ${exchange.dropoff}`,
      `Service mode: ${exchange.service_window_mode === "scheduled" ? "Scheduled" : "ASAP"}`,
      `Estimated travel: ${eta}`,
      `Reply CONFIRM when enroute.`,
    ].join("\n")
  }

  const copySmsDraft = async (exchange: Exchange) => {
    try {
      await navigator.clipboard.writeText(getCourierSmsDraft(exchange))
      setCopiedDraftExchangeId(exchange.id)
      setMessage("Courier SMS draft copied to clipboard.")
      setTimeout(() => setCopiedDraftExchangeId(""), 1500)
    } catch {
      setError("Unable to copy draft. Please copy manually from the text box.")
    }
  }

  const quotedRevenueIn = exchanges.reduce(
    (sum, exchange) => sum + (exchange.quoted_total_cents ?? 0),
    0
  ) / 100

  const courierPayoutOut = exchanges.reduce(
    (sum, exchange) => sum + (exchange.courier_payout_cents ?? 0),
    0
  ) / 100

  const statementRevenueIn = financialEntries
    .filter((entry) => entry.direction === "in")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const statementExpenseOut = financialEntries
    .filter((entry) => entry.direction === "out")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const partnershipExpenseOut = financialEntries
    .filter((entry) => ["rideshare", "uhaul", "rental_car", "movers"].includes(entry.category) && entry.direction === "out")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const commercialRevenueIn = financialEntries
    .filter((entry) => entry.category === "commercial" && entry.direction === "in")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const emergencyFundTracked = emergencyFundBalance + financialEntries
    .filter((entry) => entry.category === "emergency_fund")
    .reduce((sum, entry) => sum + (entry.direction === "in" ? entry.amount : -entry.amount), 0)

  const filteredFinancialEntries = financialEntries.filter((entry) => {
    const entryDate = new Date(entry.date)
    if (Number.isNaN(entryDate.getTime())) {
      return false
    }

    if (statementStartDate) {
      const start = new Date(`${statementStartDate}T00:00:00`)
      if (entryDate < start) {
        return false
      }
    }

    if (statementEndDate) {
      const end = new Date(`${statementEndDate}T23:59:59.999`)
      if (entryDate > end) {
        return false
      }
    }

    return true
  })

  const filteredStatementRevenueIn = filteredFinancialEntries
    .filter((entry) => entry.direction === "in")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const filteredStatementExpenseOut = filteredFinancialEntries
    .filter((entry) => entry.direction === "out")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const filteredPartnershipExpenseOut = filteredFinancialEntries
    .filter((entry) => ["rideshare", "uhaul", "rental_car", "movers"].includes(entry.category) && entry.direction === "out")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const filteredCommercialRevenueIn = filteredFinancialEntries
    .filter((entry) => entry.category === "commercial" && entry.direction === "in")
    .reduce((sum, entry) => sum + entry.amount, 0)

  const filteredEmergencyFundTracked = emergencyFundBalance + filteredFinancialEntries
    .filter((entry) => entry.category === "emergency_fund")
    .reduce((sum, entry) => sum + (entry.direction === "in" ? entry.amount : -entry.amount), 0)

  const exportFinancialEntriesCsv = () => {
    if (filteredFinancialEntries.length === 0) {
      setError("No financial entries available for the selected date range.")
      return
    }

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = filteredFinancialEntries.map((entry) => {
      const amount = `${entry.direction === "in" ? "" : "-"}${entry.amount.toFixed(2)}`
      return [
        new Date(entry.date).toISOString(),
        entry.category,
        entry.direction,
        amount,
        entry.note || "",
      ]
        .map((cell) => escapeCsv(String(cell)))
        .join(",")
    })

    const header = ["date", "category", "direction", "amount_usd", "note"]
      .map((cell) => `"${cell}"`)
      .join(",")

    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const startLabel = statementStartDate || "all"
    const endLabel = statementEndDate || "all"
    link.href = url
    link.download = `dispatcher-financial-statements-${startLabel}-to-${endLabel}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setMessage("Financial statements CSV exported.")
    setError("")
  }

  const netFlow = quotedRevenueIn + statementRevenueIn - courierPayoutOut - statementExpenseOut
  const filteredNetFlow = quotedRevenueIn + filteredStatementRevenueIn - courierPayoutOut - filteredStatementExpenseOut

  return (
    <div className="section-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">{productName}</p>
        <h1 className="text-3xl font-bold text-safe-900">{title}</h1>
        <p className="text-safe-500 text-sm mt-1">{subtitle}</p>
      </div>

      <div className="rounded-3xl border border-safe-200/80 bg-gradient-to-r from-safe-950 via-safe-900 to-safe-800 px-5 py-4 text-white shadow-lg shadow-safe-950/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-safe-300">Top-line Security</p>
            <p className="text-sm text-safe-100 max-w-2xl">
              Admin-only access with role-based authentication, audit-ready dispatch logging, and secure courier assignment workflow.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-safe-100/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-safe-100">
            Security first • Staff & customer safety</span>
        </div>
      </div>

      <div className="card border border-safe-100 bg-safe-50/70 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Dispatcher Copilot Mode</p>
            <p className="text-sm text-safe-700">Switch between deterministic heuristics and model-generated recommendations.</p>
          </div>
          <div className="inline-flex rounded-xl border border-safe-200 bg-white p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${copilotMode === "heuristic" ? "bg-safe-900 text-white" : "text-safe-600"}`}
              onClick={() => setCopilotMode("heuristic")}
            >
              Heuristic
            </button>
            <button
              type="button"
              disabled={!llmCopilotEnabled}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${copilotMode === "llm" ? "bg-safe-900 text-white" : "text-safe-600"} disabled:opacity-50`}
              onClick={() => setCopilotMode("llm")}
            >
              LLM Narrative
            </button>
          </div>
        </div>
        {!llmCopilotEnabled ? (
          <p className="text-xs text-safe-500">Enable LLM mode with NEXT_PUBLIC_ENABLE_LLM_COPILOT=1 and OPENAI_API_KEY on server.</p>
        ) : null}
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {loading ? (
        <div className="card">Loading dispatch data…</div>
      ) : (
        <>
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Open Exchanges</h2>
            <div className="space-y-3">
              {exchanges.map((exchange) => (
                <div key={exchange.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-safe-900">Exchange #{exchange.id.slice(0, 8).toUpperCase()}</p>
                    <span className="badge-active capitalize">{exchange.status}</span>
                  </div>
                  <p className="text-xs text-safe-500">{exchange.pickup} to {exchange.dropoff}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-purple-800 capitalize">
                      {exchange.vehicle_type} vehicle
                    </span>
                    {(exchange.quoted_total_cents || exchange.quoted_distance_miles || exchange.requested_service_at) && (
                      <>
                        {exchange.quoted_total_cents ? (
                          <span className="rounded-full bg-warm-100 px-2.5 py-1 text-warm-800">
                            Quote ${(exchange.quoted_total_cents / 100).toFixed(2)}
                          </span>
                        ) : null}
                        {exchange.quoted_distance_miles ? (
                          <span className="rounded-full bg-safe-100 px-2.5 py-1 text-safe-700">
                            {exchange.quoted_distance_miles} mi · {exchange.quoted_duration_minutes ?? 0} min
                          </span>
                        ) : null}
                        {exchange.service_window_mode ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
                            {exchange.service_window_mode === "scheduled" && exchange.requested_service_at
                              ? `Scheduled ${new Date(exchange.requested_service_at).toLocaleString()}`
                              : "ASAP"}
                          </span>
                        ) : null}
                        {exchange.quoted_is_after_hours ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">After-hours</span> : null}
                        {exchange.quoted_is_weekend ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">Weekend</span> : null}
                        {exchange.quoted_is_high_risk ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">High-risk</span> : null}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
                    <select
                      className="input"
                      value={selectedCourier[exchange.id] ?? exchange.courier_id ?? ""}
                      onChange={(event) =>
                        setSelectedCourier((prev) => ({
                          ...prev,
                          [exchange.id]: event.target.value,
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
                      className="btn-ghost"
                      type="button"
                      disabled={lookupId === exchange.id}
                      onClick={() => findNearby(exchange)}
                    >
                      {lookupId === exchange.id ? "Searching..." : "Find Nearby"}
                    </button>

                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => assignCourier(exchange)}
                    >
                      Assign
                    </button>

                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => updateStatus(exchange, "assigned")}
                    >
                      Mark Assigned
                    </button>

                    <button
                      className="btn-primary"
                      type="button"
                      disabled={workingId === exchange.id}
                      onClick={() => updateStatus(exchange, "completed")}
                    >
                      Complete
                    </button>
                  </div>

                  <div className="rounded-xl border border-safe-100 bg-white px-3 py-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-500">AI Dispatcher Copilot</p>
                      <span className="text-[11px] text-safe-500">Suggest-only mode</span>
                    </div>
                    <p className="text-xs text-safe-700">{getDispatchSummary(exchange)}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={copilotLoadingExchangeId === exchange.id}
                        onClick={() => applyCourierRecommendation(exchange)}
                      >
                        {copilotLoadingExchangeId === exchange.id ? "Thinking..." : "Recommend Courier"}
                      </button>
                      {copilotMode === "llm" && llmCopilotEnabled ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={copilotLoadingExchangeId === exchange.id}
                          onClick={() => requestLlmSuggestion(exchange)}
                        >
                          Refresh AI Suggestion
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => copySmsDraft(exchange)}
                      >
                        {copiedDraftExchangeId === exchange.id ? "Copied" : "Copy SMS Draft"}
                      </button>
                    </div>
                    <textarea
                      className="input min-h-[90px] text-xs"
                      readOnly
                      value={getCourierSmsDraft(exchange)}
                    />
                  </div>

                  {nearbyCouriers[exchange.id]?.length ? (
                    <div className="rounded-xl border border-safe-100 bg-white px-3 py-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-safe-500">Nearby courier matches</p>
                      <div className="space-y-2">
                        {nearbyCouriers[exchange.id].map((courier) => (
                          <button
                            key={courier.courier_id}
                            type="button"
                            className="w-full rounded-lg border border-safe-100 px-3 py-2 text-left hover:bg-safe-50"
                            onClick={() =>
                              setSelectedCourier((prev) => ({
                                ...prev,
                                [exchange.id]: courier.user_id,
                              }))
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-safe-900">
                                {courier.first_name} {courier.last_name}
                              </span>
                              <span className="text-xs text-safe-500">
                                {courier.distance_miles.toFixed(1)} mi · {courier.vehicle_type}
                              </span>
                            </div>
                            <p className="text-xs text-safe-500">
                              Rating {courier.rating ?? 0} · {courier.total_deliveries} deliveries · {courier.status}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-safe-900">Dispatch Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-safe-500">No events yet.</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-safe-900 capitalize">{event.event_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-safe-400">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-safe-500 mt-1">Exchange #{event.exchange_id.slice(0, 8).toUpperCase()}</p>
                    {event.note && <p className="text-sm text-safe-700 mt-2">{event.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Financial Mapping & Tax Tracker</h2>
            <p className="text-xs text-safe-500">
              Track revenue in/out, commercial services, partnerships, emergency funds, and tax-supporting statements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Quoted Revenue In</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${quotedRevenueIn.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Courier + Ops Out</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${(courierPayoutOut + statementExpenseOut).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Net Flow</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${filteredNetFlow.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Commercial Services In</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${filteredCommercialRevenueIn.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Partnership Expense Out</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${filteredPartnershipExpenseOut.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3">
                <p className="text-xs text-safe-500">Emergency Fund Tracker</p>
                <p className="text-xl font-bold text-safe-900 mt-1">${filteredEmergencyFundTracked.toFixed(2)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-safe-100 bg-white px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-safe-900">Financial Tracker Statement</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <select
                  className="input"
                  value={entryForm.category}
                  onChange={(event) => setEntryForm((prev) => ({ ...prev, category: event.target.value as FinancialStatementEntry["category"] }))}
                >
                  <option value="commercial">Commercial services</option>
                  <option value="rideshare">Partnership rideshare</option>
                  <option value="uhaul">Partnership U-Haul</option>
                  <option value="rental_car">Partnership rental car</option>
                  <option value="movers">Partnership movers</option>
                  <option value="emergency_fund">Emergency funds</option>
                </select>
                <select
                  className="input"
                  value={entryForm.direction}
                  onChange={(event) => setEntryForm((prev) => ({ ...prev, direction: event.target.value as FinancialStatementEntry["direction"] }))}
                >
                  <option value="in">Revenue In</option>
                  <option value="out">Expense Out</option>
                </select>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={entryForm.amount}
                  onChange={(event) => setEntryForm((prev) => ({ ...prev, amount: event.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Statement note"
                  value={entryForm.note}
                  onChange={(event) => setEntryForm((prev) => ({ ...prev, note: event.target.value }))}
                />
                <button type="button" className="btn-primary" onClick={addFinancialEntry}>
                  Add Statement
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <p className="text-xs text-safe-500">Set baseline emergency fund balance for reconciliation.</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-safe-500">Baseline $</span>
                  <input
                    className="input w-40"
                    type="number"
                    min="0"
                    step="0.01"
                    value={emergencyFundBalance}
                    onChange={(event) => setEmergencyFundBalance(Number(event.target.value || 0))}
                  />
                  <button type="button" className="btn-secondary" onClick={saveEmergencyFundBaseline}>
                    Save
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-safe-100 bg-safe-50 px-3 py-3">
                  <p className="text-xs font-semibold text-safe-700">Date-range filters & export</p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                    <label className="text-xs text-safe-500">
                      Start
                      <input
                        className="input mt-1"
                        type="date"
                        value={statementStartDate}
                        onChange={(event) => setStatementStartDate(event.target.value)}
                      />
                    </label>
                    <label className="text-xs text-safe-500">
                      End
                      <input
                        className="input mt-1"
                        type="date"
                        value={statementEndDate}
                        onChange={(event) => setStatementEndDate(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setStatementStartDate("")
                        setStatementEndDate("")
                      }}
                    >
                      Clear
                    </button>
                    <button type="button" className="btn-secondary" onClick={exportFinancialEntriesCsv}>
                      Export CSV
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-safe-500">
                    Showing {filteredFinancialEntries.length} statement entries for selected range.
                  </p>
                </div>

                {filteredFinancialEntries.length === 0 ? (
                  <p className="text-xs text-safe-500">No financial statements recorded yet.</p>
                ) : (
                  filteredFinancialEntries.slice(0, 12).map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-safe-100 bg-safe-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-safe-800 capitalize">{entry.category.replace(/_/g, " ")}</span>
                      <span className={entry.direction === "in" ? "text-emerald-700" : "text-red-700"}>
                        {entry.direction === "in" ? "+" : "-"}${entry.amount.toFixed(2)}
                      </span>
                      <span className="text-safe-500">{entry.note || "No note"}</span>
                      <span className="text-safe-400">{new Date(entry.date).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-safe-900">Supporting Docs & Partnership Checklists</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-safe-100 bg-safe-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-safe-900">Supporting Docs Area</p>
                <div className="space-y-2">
                  {supportingDocs.map((doc) => (
                    <label key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-safe-100 bg-white px-3 py-2 text-xs">
                      <span className="text-safe-700">{doc.label}</span>
                      <input
                        type="checkbox"
                        checked={doc.checked}
                        onChange={() => toggleSupportingDoc(doc.id)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-safe-100 bg-safe-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-safe-900">Partnership Rideshare Service Checklist</p>
                  <p className="text-xs text-safe-500 mt-1">LYF = Lyft, UBR = Uber, TXI = Taxi</p>
                  <ul className="mt-2 space-y-1 text-xs text-safe-700">
                    <li>Emergency pickup verified for victim/person in danger</li>
                    <li>Driver partner logged: LYF / UBR / TXI</li>
                    <li>Pickup and dropoff timestamp captured</li>
                    <li>Trip receipt attached to statement</li>
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold text-safe-900">U-Haul & Rental Car Checklist Supplies</p>
                  <ul className="mt-2 space-y-1 text-xs text-safe-700">
                    <li>Truck/van reservation confirmation</li>
                    <li>Supply charges tracked: tape, wrapping tape, boxes</li>
                    <li>Fuel and mileage receipts captured</li>
                    <li>Return condition checklist completed</li>
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold text-safe-900">Partnership Mover Companies (Pre-Planned)</p>
                  <ul className="mt-2 space-y-1 text-xs text-safe-700">
                    <li>Move scope approved and scheduled with customer</li>
                    <li>Added materials billed: tape, wrapping, boxes</li>
                    <li>Large-item handling surcharge documented</li>
                    <li>Final invoice copied into financial statement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

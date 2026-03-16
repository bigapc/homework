"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

// ─── Pricing constants ────────────────────────────────────────────
const BASE_RATE      = 12.00   // flat base per exchange
const PER_MILE_RATE  = 2.50    // per road mile
const FUEL_SURCHARGE = 1.25    // flat fuel fee
const SERVICE_FEE    = 0.12    // 12% of subtotal
const AFTER_HOURS_SURCHARGE = 12.00
const WEEKEND_SURCHARGE = 8.00
const HIGH_RISK_SURCHARGE = 15.00

function getOperationalFlags(requestedAt: Date) {
  const day = requestedAt.getDay()
  const hour = requestedAt.getHours()

  return {
    isWeekend: day === 0 || day === 6,
    isAfterHours: hour < 8 || hour >= 18,
  }
}

function calcPricing(miles: number, requestedAt: Date, highRisk: boolean) {
  const { isWeekend, isAfterHours } = getOperationalFlags(requestedAt)
  const mileage   = miles * PER_MILE_RATE
  const afterHours = isAfterHours ? AFTER_HOURS_SURCHARGE : 0
  const weekend = isWeekend ? WEEKEND_SURCHARGE : 0
  const highRiskFee = highRisk ? HIGH_RISK_SURCHARGE : 0
  const subtotalBeforeServiceFee = BASE_RATE + mileage + afterHours + weekend + highRiskFee
  const svcFee = subtotalBeforeServiceFee * SERVICE_FEE
  const total = subtotalBeforeServiceFee + svcFee + FUEL_SURCHARGE

  return {
    mileage,
    afterHours,
    weekend,
    highRiskFee,
    subtotalBeforeServiceFee,
    svcFee,
    total,
    isWeekend,
    isAfterHours,
    isHighRisk: highRisk,
  }
}

// ─── Types ────────────────────────────────────────────────────────
type Suggestion = {
  place_name: string
  center: [number, number] // [lng, lat]
}

type SelectedLocation = {
  label: string
  lng: number
  lat: number
}

export type PricingResult = {
  pickup:  SelectedLocation
  dropoff: SelectedLocation
  miles:   number
  total:   number
  minutes: number
  serviceWindowMode: "asap" | "scheduled"
  requestedServiceAt: string | null
  requestTimingLabel: string
  breakdown: {
    baseRate: number
    mileage: number
    afterHours: number
    weekend: number
    highRiskFee: number
    fuelSurcharge: number
    svcFee: number
    total: number
    isWeekend: boolean
    isAfterHours: boolean
    isHighRisk: boolean
  }
}

type Props = {
  onQuoteReady?: (result: PricingResult) => void
}

// ─── Mapbox helpers ───────────────────────────────────────────────
async function geocode(query: string, token: string): Promise<Suggestion[]> {
  if (!token || query.trim().length < 3) return []
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${token}&autocomplete=true&types=address,place&limit=5`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = await res.json()
  return (json.features ?? []).map((f: { place_name: string; center: [number, number] }) => ({
    place_name: f.place_name,
    center: f.center,
  }))
}

async function fetchRoute(pickup: SelectedLocation, dropoff: SelectedLocation, token: string) {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}` +
    `?access_token=${token}&overview=false`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const route = json.routes?.[0]
  if (!route) return null
  return {
    miles:   Math.round((route.distance / 1609.34) * 100) / 100,
    minutes: Math.round(route.duration / 60),
  }
}

function buildStaticRoutePreviewUrl(pickup: SelectedLocation, dropoff: SelectedLocation, token: string) {
  const startPin = `pin-s-a+2f9e44(${pickup.lng},${pickup.lat})`
  const endPin = `pin-s-b+ef4444(${dropoff.lng},${dropoff.lat})`
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${startPin},${endPin}/auto/880x300?padding=60,40,60,40&access_token=${token}`
}

// ─── Address input w/ autocomplete ───────────────────────────────
function AddressInput({
  label,
  placeholder,
  value,
  onSelect,
  token,
  icon,
}: {
  label: string
  placeholder: string
  value: string
  onSelect: (loc: SelectedLocation) => void
  token: string
  icon: string
}) {
  const [query, setQuery]           = useState(value)
  const [suggestions, setSugg]      = useState<Suggestion[]>([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                  = useRef<HTMLDivElement>(null)

  // sync external reset
  useEffect(() => { setQuery(value) }, [value])

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setSugg([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) return
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await geocode(val, token)
      setSugg(results)
      setOpen(results.length > 0)
      setLoading(false)
    }, 350)
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.place_name)
    setSugg([])
    setOpen(false)
    onSelect({ label: s.place_name, lng: s.center[0], lat: s.center[1] })
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-semibold text-safe-400 mb-1.5 uppercase tracking-wide">
        <span className="mr-1">{icon}</span>{label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="input w-full pr-8"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block w-3.5 h-3.5 border-2 border-safe-300 border-t-safe-600 rounded-full animate-spin" />
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-safe-200 rounded-xl shadow-card-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-safe-800 hover:bg-safe-50 transition-colors border-b border-safe-100 last:border-0"
              >
                <span className="font-medium">{s.place_name.split(",")[0]}</span>
                <span className="text-safe-500 text-xs">
                  {s.place_name.split(",").slice(1).join(",")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────
export default function PricingQuote({ onQuoteReady }: Props) {
  const token   = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""
  const [pickup, setPickup]   = useState<SelectedLocation | null>(null)
  const [dropoff, setDropoff] = useState<SelectedLocation | null>(null)
  const [pickupLabel, setPickupLabel]   = useState("")
  const [dropoffLabel, setDropoffLabel] = useState("")
  const [quote, setQuote]   = useState<{ miles: number; minutes: number } | null>(null)
  const [serviceMode, setServiceMode] = useState<"asap" | "scheduled">("asap")
  const [scheduledAt, setScheduledAt] = useState("")
  const [highRisk, setHighRisk] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [routeError, setRouteError] = useState("")

  const getQuote = useCallback(async () => {
    if (!pickup || !dropoff || !token) return
    setFetching(true)
    setRouteError("")
    setQuote(null)
    const route = await fetchRoute(pickup, dropoff, token)
    if (!route) {
      setRouteError("Could not calculate a route between those addresses. Please try different locations.")
      setFetching(false)
      return
    }
    setQuote(route)
    setFetching(false)
  }, [pickup, dropoff, token])

  // auto-fetch when both locations are selected
  useEffect(() => {
    if (pickup && dropoff) getQuote()
    else setQuote(null)
  }, [pickup, dropoff, getQuote])

  const hasTimingSelection = serviceMode === "asap" || scheduledAt.length > 0
  const requestedAt = serviceMode === "scheduled" && scheduledAt
    ? new Date(scheduledAt)
    : new Date()
  const requestTimingLabel = serviceMode === "scheduled" && scheduledAt
    ? new Date(scheduledAt).toLocaleString()
    : "ASAP / Now"
  const pricing = quote && hasTimingSelection ? calcPricing(quote.miles, requestedAt, highRisk) : null

  useEffect(() => {
    if (!pickup || !dropoff || !quote || !pricing) {
      return
    }

    onQuoteReady?.({
      pickup,
      dropoff,
      miles: quote.miles,
      total: pricing.total,
      minutes: quote.minutes,
      serviceWindowMode: serviceMode,
      requestedServiceAt: serviceMode === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      requestTimingLabel,
      breakdown: {
        baseRate: BASE_RATE,
        mileage: pricing.mileage,
        afterHours: pricing.afterHours,
        weekend: pricing.weekend,
        highRiskFee: pricing.highRiskFee,
        fuelSurcharge: FUEL_SURCHARGE,
        svcFee: pricing.svcFee,
        total: pricing.total,
        isWeekend: pricing.isWeekend,
        isAfterHours: pricing.isAfterHours,
        isHighRisk: pricing.isHighRisk,
      },
    })
  }, [pickup, dropoff, quote, pricing, requestTimingLabel, serviceMode, scheduledAt, onQuoteReady])

  return (
    <div className="card space-y-6 border-warm-400/30 bg-gradient-to-br from-white to-safe-50">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-warm-400/20 text-warm-500 text-lg font-bold">
          $
        </div>
        <div>
          <h2 className="text-lg font-bold text-safe-900">Real-Time Pricing Quote</h2>
          <p className="text-xs text-safe-500">Enter pickup and dropoff to get an instant fare estimate.</p>
        </div>
      </div>

      {/* Address inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AddressInput
          label="Pickup Location"
          placeholder="e.g. 123 Main St, Casper WY"
          value={pickupLabel}
          icon="🟢"
          token={token}
          onSelect={(loc) => { setPickup(loc); setPickupLabel(loc.label) }}
        />
        <AddressInput
          label="Dropoff Location"
          placeholder="e.g. 456 Park Ave, Casper WY"
          value={dropoffLabel}
          icon="🔴"
          token={token}
          onSelect={(loc) => { setDropoff(loc); setDropoffLabel(loc.label) }}
        />
      </div>

      {/* Pricing conditions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <label className="block text-xs font-semibold text-safe-400 mb-1.5 uppercase tracking-wide">
            Requested Service Window
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
            <select
              value={serviceMode}
              onChange={(e) => setServiceMode(e.target.value as "asap" | "scheduled")}
              className="input"
            >
              <option value="asap">ASAP / Immediate</option>
              <option value="scheduled">Scheduled</option>
            </select>

            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={serviceMode !== "scheduled"}
              className="input disabled:bg-safe-100 disabled:text-safe-400"
            />
          </div>
          <p className="mt-1 text-[11px] text-safe-500">
            After-hours requests from 6:00 PM to 8:00 AM and weekend requests automatically add operational surcharges.
          </p>
        </div>

        <label className="rounded-xl border border-safe-200 bg-white px-4 py-3 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={highRisk}
            onChange={(e) => setHighRisk(e.target.checked)}
            className="mt-1 h-4 w-4 accent-warm-400"
          />
          <div>
            <p className="text-sm font-semibold text-safe-900">High-risk or sensitive retrieval</p>
            <p className="text-[11px] leading-relaxed text-safe-500">
              Adds enhanced handling, safety coordination, and dispatch review for volatile pickup conditions.
            </p>
          </div>
        </label>
      </div>

      {/* Loading state */}
      {fetching && (
        <div className="flex items-center gap-2 text-sm text-safe-500">
          <span className="inline-block w-4 h-4 border-2 border-safe-300 border-t-safe-600 rounded-full animate-spin" />
          Calculating route and pricing…
        </div>
      )}

      {/* Error */}
      {routeError && (
        <div className="alert-error text-sm">{routeError}</div>
      )}

      {!hasTimingSelection && quote && !fetching && (
        <div className="alert-info text-sm">
          Select a scheduled date and time to calculate the final quote with time-based surcharges.
        </div>
      )}

      {/* Quote result */}
      {quote && pricing && !fetching && (
        <div className="animate-fade-in space-y-4">

          {/* Map preview */}
          {pickup && dropoff && token && (
            <div className="overflow-hidden rounded-xl border border-safe-200 bg-white">
              <Image
                src={buildStaticRoutePreviewUrl(pickup, dropoff, token)}
                alt="Pickup and dropoff route preview"
                width={880}
                height={300}
                className="block h-48 w-full object-cover"
                unoptimized
              />
              <div className="grid grid-cols-1 gap-2 border-t border-safe-100 bg-safe-50 px-4 py-3 text-xs text-safe-600 sm:grid-cols-2">
                <p className="truncate">
                  <span className="mr-1 font-semibold text-safe-800">A:</span>
                  {pickup.label}
                </p>
                <p className="truncate">
                  <span className="mr-1 font-semibold text-safe-800">B:</span>
                  {dropoff.label}
                </p>
              </div>
            </div>
          )}

          {/* Route summary strip */}
          <div className="flex flex-wrap items-center gap-4 bg-safe-900 text-white rounded-xl px-5 py-3">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-safe-400">Distance</p>
              <p className="text-xl font-bold">{quote.miles} <span className="text-sm font-normal text-safe-300">mi</span></p>
            </div>
            <div className="w-px h-8 bg-safe-700 hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-safe-400">Est. Drive Time</p>
              <p className="text-xl font-bold">{quote.minutes} <span className="text-sm font-normal text-safe-300">min</span></p>
            </div>
            <div className="w-px h-8 bg-safe-700 hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-safe-400">Service Window</p>
              <p className="text-sm font-semibold">{serviceMode === "scheduled" ? "Scheduled" : "ASAP"}</p>
            </div>
            <div className="w-px h-8 bg-safe-700 hidden sm:block" />
            <div className="text-center ml-auto">
              <p className="text-[10px] uppercase tracking-widest text-warm-400">Total Estimate</p>
              <p className="text-3xl font-black text-warm-400">${pricing.total.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className="rounded-full bg-safe-100 px-3 py-1 text-safe-700">Timing: {requestTimingLabel}</span>
            {pricing.isAfterHours && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">After-hours surcharge</span>
            )}
            {pricing.isWeekend && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Weekend surcharge</span>
            )}
            {pricing.isHighRisk && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">High-risk handling</span>
            )}
          </div>

          {/* Fare breakdown */}
          <div className="bg-white border border-safe-100 rounded-xl overflow-hidden text-sm">
            <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
              <span className="text-safe-600">Base rate</span>
              <span className="font-medium text-safe-900">${BASE_RATE.toFixed(2)}</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
              <span className="text-safe-600">Mileage ({quote.miles} mi × ${PER_MILE_RATE}/mi)</span>
              <span className="font-medium text-safe-900">${pricing.mileage.toFixed(2)}</span>
            </div>
            {pricing.afterHours > 0 && (
              <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
                <span className="text-safe-600">After-hours operations</span>
                <span className="font-medium text-safe-900">${pricing.afterHours.toFixed(2)}</span>
              </div>
            )}
            {pricing.weekend > 0 && (
              <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
                <span className="text-safe-600">Weekend dispatch coverage</span>
                <span className="font-medium text-safe-900">${pricing.weekend.toFixed(2)}</span>
              </div>
            )}
            {pricing.highRiskFee > 0 && (
              <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
                <span className="text-safe-600">High-risk handling</span>
                <span className="font-medium text-safe-900">${pricing.highRiskFee.toFixed(2)}</span>
              </div>
            )}
            <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
              <span className="text-safe-600">Fuel surcharge</span>
              <span className="font-medium text-safe-900">${FUEL_SURCHARGE.toFixed(2)}</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between border-b border-safe-100">
              <span className="text-safe-600">Service fee (12%)</span>
              <span className="font-medium text-safe-900">${pricing.svcFee.toFixed(2)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between bg-safe-50">
              <span className="font-bold text-safe-900">Estimated Total</span>
              <span className="font-black text-warm-500 text-base">${pricing.total.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[11px] text-safe-500 leading-relaxed">
            * This is an estimate based on current road routing. Final fare may vary due to traffic, detours,
            or additional handling requests. All pricing is confidential between you and SafeConnect.
          </p>

          {/* Reset */}
          <button
            type="button"
            onClick={() => {
              setPickup(null); setDropoff(null)
              setPickupLabel(""); setDropoffLabel("")
              setQuote(null); setRouteError("")
              setServiceMode("asap"); setScheduledAt(""); setHighRisk(false)
            }}
            className="text-xs text-safe-500 hover:text-safe-800 underline"
          >
            ↺ Reset quote
          </button>
        </div>
      )}

      {/* Placeholder when no addresses yet */}
      {!pickup && !dropoff && !fetching && (
        <div className="rounded-xl border border-dashed border-safe-200 bg-safe-50/50 py-6 text-center text-sm text-safe-400">
          Enter both addresses above to see your instant fare estimate.
        </div>
      )}
    </div>
  )
}

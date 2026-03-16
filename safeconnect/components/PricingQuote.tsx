"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ─── Pricing constants ────────────────────────────────────────────
const BASE_RATE      = 12.00   // flat base per exchange
const PER_MILE_RATE  = 2.50    // per road mile
const FUEL_SURCHARGE = 1.25    // flat fuel fee
const SERVICE_FEE    = 0.12    // 12% of subtotal

function calcPricing(miles: number) {
  const mileage   = miles * PER_MILE_RATE
  const subtotal  = BASE_RATE + mileage
  const svcFee    = subtotal * SERVICE_FEE
  const total     = subtotal + svcFee + FUEL_SURCHARGE
  return { mileage, subtotal, svcFee, total }
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
    onQuoteReady?.({
      pickup,
      dropoff,
      miles:   route.miles,
      total:   calcPricing(route.miles).total,
      minutes: route.minutes,
    })
    setFetching(false)
  }, [pickup, dropoff, token, onQuoteReady])

  // auto-fetch when both locations are selected
  useEffect(() => {
    if (pickup && dropoff) getQuote()
    else setQuote(null)
  }, [pickup, dropoff, getQuote])

  const pricing = quote ? calcPricing(quote.miles) : null

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

      {/* Quote result */}
      {quote && pricing && !fetching && (
        <div className="animate-fade-in space-y-4">

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
            <div className="text-center ml-auto">
              <p className="text-[10px] uppercase tracking-widest text-warm-400">Total Estimate</p>
              <p className="text-3xl font-black text-warm-400">${pricing.total.toFixed(2)}</p>
            </div>
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

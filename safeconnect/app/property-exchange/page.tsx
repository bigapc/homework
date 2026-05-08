"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import PricingQuote, { type PricingResult } from "@/components/PricingQuote"

type SupplyKey = "boxesSmall" | "boxesMedium" | "boxesLarge" | "bubbleWrapPerFoot" | "stretchWrapPerFoot" | "wrappingTapePerRoll"

const SUPPLY_PRICING: Record<SupplyKey, { label: string; unit: string; price: number; hint: string }> = {
  boxesSmall: {
    label: "Small moving box",
    unit: "12 x 12 x 12 in",
    price: 2.25,
    hint: "Books, kitchenware, and compact items",
  },
  boxesMedium: {
    label: "Medium moving box",
    unit: "18 x 18 x 16 in",
    price: 3.75,
    hint: "General household items",
  },
  boxesLarge: {
    label: "Large moving box",
    unit: "24 x 18 x 18 in",
    price: 5.5,
    hint: "Bedding and lighter bulky goods",
  },
  bubbleWrapPerFoot: {
    label: "Bubble wrap",
    unit: "per foot",
    price: 0.45,
    hint: "Quoted by linear feet",
  },
  stretchWrapPerFoot: {
    label: "Stretch wrap",
    unit: "per foot",
    price: 0.32,
    hint: "Quoted by linear feet",
  },
  wrappingTapePerRoll: {
    label: "Wrapping tape",
    unit: "per 55-yd roll",
    price: 4.25,
    hint: "Heavy-duty tape roll",
  },
}

const VEHICLE_UPCHARGE = {
  xl: 70,
  cargoVan: 120,
  boxTruck: 190,
} as const

export default function PropertyExchangePage() {
  const [quoteResult, setQuoteResult] = useState<PricingResult | null>(null)
  const [serviceDateTime, setServiceDateTime] = useState("")
  const [vehicleClass, setVehicleClass] = useState<keyof typeof VEHICLE_UPCHARGE>("cargoVan")
  const [extraCouriers, setExtraCouriers] = useState(1)
  const [additionalStops, setAdditionalStops] = useState(0)
  const [includeReturnTrip, setIncludeReturnTrip] = useState(false)
  const [supplies, setSupplies] = useState<Record<SupplyKey, number>>({
    boxesSmall: 0,
    boxesMedium: 0,
    boxesLarge: 0,
    bubbleWrapPerFoot: 0,
    stretchWrapPerFoot: 0,
    wrappingTapePerRoll: 0,
  })

  const supplySubtotal = useMemo(() => {
    return (Object.keys(SUPPLY_PRICING) as SupplyKey[]).reduce((sum, key) => {
      return sum + supplies[key] * SUPPLY_PRICING[key].price
    }, 0)
  }, [supplies])

  const extraCourierTotal = extraCouriers * 55
  const stopTotal = additionalStops * 25
  const returnTripTotal = includeReturnTrip ? 40 : 0
  const vehicleUpcharge = VEHICLE_UPCHARGE[vehicleClass]
  const routeBase = quoteResult?.total ?? 0

  const appointmentQuote = routeBase + vehicleUpcharge + extraCourierTotal + stopTotal + returnTripTotal + supplySubtotal

  return (
    <div className="page-container space-y-8 animate-fade-in">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Main Service</p>
        <h1 className="text-3xl font-bold text-safe-900">Large Property Exchange Scheduler</h1>
        <p className="text-safe-500 text-sm">
          Schedule larger transports with bigger vehicles, extra couriers, return routes, extra stops, and supply pricing before booking.
        </p>
      </div>

      <div className="card border border-warm-200 bg-warm-50/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-safe-900">Need to book now?</p>
            <p className="text-xs text-safe-600 mt-1">Use this quote to prepare, then submit the final secured request in Courier Services.</p>
          </div>
          <Link href="/request" className="btn-secondary">Go To Courier Services</Link>
        </div>
      </div>

      <PricingQuote onQuoteReady={(result) => setQuoteResult(result)} />

      <div className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-safe-900">Large Transport Appointment Builder</h2>
          <span className="badge-active">Quote Builder</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Appointment Date & Time</label>
            <input
              className="input"
              type="datetime-local"
              value={serviceDateTime}
              onChange={(event) => setServiceDateTime(event.target.value)}
            />
          </div>

          <div>
            <label className="label">Large Vehicle Class</label>
            <select
              className="input"
              value={vehicleClass}
              onChange={(event) => setVehicleClass(event.target.value as keyof typeof VEHICLE_UPCHARGE)}
            >
              <option value="xl">XL Exchange Van (+$70)</option>
              <option value="cargoVan">Cargo Van (+$120)</option>
              <option value="boxTruck">Box Truck (+$190)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Extra Couriers</label>
            <input
              className="input"
              type="number"
              min={0}
              max={6}
              value={extraCouriers}
              onChange={(event) => setExtraCouriers(Number(event.target.value || 0))}
            />
            <p className="text-xs text-safe-500 mt-1">$55 each</p>
          </div>

          <div>
            <label className="label">Additional Stops</label>
            <input
              className="input"
              type="number"
              min={0}
              max={8}
              value={additionalStops}
              onChange={(event) => setAdditionalStops(Number(event.target.value || 0))}
            />
            <p className="text-xs text-safe-500 mt-1">$25 each stop</p>
          </div>

          <div>
            <label className="label">Return Option</label>
            <label className="flex items-center justify-between rounded-lg border border-safe-100 bg-safe-50 px-3 py-2 mt-0.5">
              <span className="text-safe-700 text-sm">Include return route</span>
              <input
                type="checkbox"
                checked={includeReturnTrip}
                onChange={(event) => setIncludeReturnTrip(event.target.checked)}
              />
            </label>
            <p className="text-xs text-safe-500 mt-1">+$40 return handling</p>
          </div>
        </div>

        <div className="rounded-xl border border-safe-100 bg-safe-50 p-4 space-y-3">
          <h3 className="font-semibold text-safe-900">Supply List Quote (inches, feet, and wrapping tape)</h3>
          <div className="space-y-2">
            {(Object.keys(SUPPLY_PRICING) as SupplyKey[]).map((key) => {
              const item = SUPPLY_PRICING[key]
              const quantity = supplies[key]
              const lineTotal = quantity * item.price

              return (
                <div key={key} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center rounded-lg border border-safe-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-safe-900">{item.label}</p>
                    <p className="text-xs text-safe-500">{item.unit} · {item.hint} · ${item.price.toFixed(2)}</p>
                  </div>
                  <input
                    className="input w-28"
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(event) =>
                      setSupplies((prev) => ({
                        ...prev,
                        [key]: Number(event.target.value || 0),
                      }))
                    }
                  />
                  <p className="text-sm font-semibold text-safe-900 text-right">${lineTotal.toFixed(2)}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-safe-100 bg-white p-4 space-y-2">
          <p className="text-sm font-semibold text-safe-900">Appointment Pricing Summary</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-safe-700">
            <p>Route base quote: <span className="font-semibold text-safe-900">${routeBase.toFixed(2)}</span></p>
            <p>Vehicle upcharge: <span className="font-semibold text-safe-900">${vehicleUpcharge.toFixed(2)}</span></p>
            <p>Extra couriers: <span className="font-semibold text-safe-900">${extraCourierTotal.toFixed(2)}</span></p>
            <p>Additional stops: <span className="font-semibold text-safe-900">${stopTotal.toFixed(2)}</span></p>
            <p>Return option: <span className="font-semibold text-safe-900">${returnTripTotal.toFixed(2)}</span></p>
            <p>Supplies subtotal: <span className="font-semibold text-safe-900">${supplySubtotal.toFixed(2)}</span></p>
          </div>
          <div className="pt-2 border-t border-safe-100 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-safe-600">
              {serviceDateTime
                ? `Scheduled: ${new Date(serviceDateTime).toLocaleString()}`
                : "Choose an appointment date and time above."}
            </p>
            <p className="text-xl font-bold text-safe-900">Estimated Total: ${appointmentQuote.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

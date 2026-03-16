export const exchangeQuoteSelectFields = [
  "service_window_mode",
  "requested_service_at",
  "quoted_distance_miles",
  "quoted_duration_minutes",
  "quoted_base_rate_cents",
  "quoted_mileage_cents",
  "quoted_after_hours_cents",
  "quoted_weekend_cents",
  "quoted_high_risk_cents",
  "quoted_fuel_surcharge_cents",
  "quoted_service_fee_cents",
  "quoted_total_cents",
  "quoted_is_after_hours",
  "quoted_is_weekend",
  "quoted_is_high_risk",
  "quoted_at",
].join(",")

export type ExchangeQuoteSnapshotLike = {
  miles: number
  total: number
  minutes: number
  serviceWindowMode: "asap" | "scheduled"
  requestedServiceAt: string | null
  breakdown: {
    baseRate: number
    mileage: number
    afterHours: number
    weekend: number
    highRiskFee: number
    fuelSurcharge: number
    svcFee: number
    isAfterHours: boolean
    isWeekend: boolean
    isHighRisk: boolean
  }
}

export function buildExchangeQuoteColumns(quote: ExchangeQuoteSnapshotLike, quotedAt = new Date().toISOString()) {
  return {
    service_window_mode: quote.serviceWindowMode,
    requested_service_at: quote.requestedServiceAt,
    quoted_distance_miles: quote.miles,
    quoted_duration_minutes: quote.minutes,
    quoted_base_rate_cents: Math.round(quote.breakdown.baseRate * 100),
    quoted_mileage_cents: Math.round(quote.breakdown.mileage * 100),
    quoted_after_hours_cents: Math.round(quote.breakdown.afterHours * 100),
    quoted_weekend_cents: Math.round(quote.breakdown.weekend * 100),
    quoted_high_risk_cents: Math.round(quote.breakdown.highRiskFee * 100),
    quoted_fuel_surcharge_cents: Math.round(quote.breakdown.fuelSurcharge * 100),
    quoted_service_fee_cents: Math.round(quote.breakdown.svcFee * 100),
    quoted_total_cents: Math.round(quote.total * 100),
    quoted_is_after_hours: quote.breakdown.isAfterHours,
    quoted_is_weekend: quote.breakdown.isWeekend,
    quoted_is_high_risk: quote.breakdown.isHighRisk,
    quoted_at: quotedAt,
  }
}

export function isMissingExchangeQuoteColumnsError(message?: string | null) {
  const value = (message ?? "").toLowerCase()
  return (
    value.includes("quoted_") ||
    value.includes("service_window_mode") ||
    value.includes("requested_service_at") ||
    value.includes("schema cache")
  )
}

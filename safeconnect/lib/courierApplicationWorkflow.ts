export const REVIEWABLE_STATUSES = ["submitted", "reviewing", "approved", "rejected"] as const

export type ReviewableCourierStatus = (typeof REVIEWABLE_STATUSES)[number]

export type PromotionLookupStrategy = "user_id" | "email"

export function isReviewableCourierStatus(status: string): status is ReviewableCourierStatus {
  return (REVIEWABLE_STATUSES as readonly string[]).includes(status)
}

export function getPromotionLookupStrategy(userId: string | null): PromotionLookupStrategy {
  return userId ? "user_id" : "email"
}

export function getApplicationReviewTimestamps(status: ReviewableCourierStatus, nowIso: string) {
  if (status === "submitted") {
    return {
      reviewedAt: null,
      approvedAt: null,
    }
  }

  return {
    reviewedAt: nowIso,
    approvedAt: status === "approved" ? nowIso : null,
  }
}

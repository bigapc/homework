import { describe, expect, it } from "vitest"
import {
  getApplicationReviewTimestamps,
  getPromotionLookupStrategy,
  isReviewableCourierStatus,
} from "../../lib/courierApplicationWorkflow"

describe("courier application workflow", () => {
  it("accepts only reviewable statuses", () => {
    expect(isReviewableCourierStatus("submitted")).toBe(true)
    expect(isReviewableCourierStatus("reviewing")).toBe(true)
    expect(isReviewableCourierStatus("approved")).toBe(true)
    expect(isReviewableCourierStatus("rejected")).toBe(true)
    expect(isReviewableCourierStatus("active")).toBe(false)
  })

  it("sets reviewed and approved timestamps for approved status", () => {
    const nowIso = "2026-04-04T12:00:00.000Z"
    const timestamps = getApplicationReviewTimestamps("approved", nowIso)

    expect(timestamps.reviewedAt).toBe(nowIso)
    expect(timestamps.approvedAt).toBe(nowIso)
  })

  it("sets reviewed timestamp and clears approved timestamp for reviewing status", () => {
    const nowIso = "2026-04-04T12:00:00.000Z"
    const timestamps = getApplicationReviewTimestamps("reviewing", nowIso)

    expect(timestamps.reviewedAt).toBe(nowIso)
    expect(timestamps.approvedAt).toBeNull()
  })

  it("clears reviewed and approved timestamps when status returns to submitted", () => {
    const nowIso = "2026-04-04T12:00:00.000Z"
    const timestamps = getApplicationReviewTimestamps("submitted", nowIso)

    expect(timestamps.reviewedAt).toBeNull()
    expect(timestamps.approvedAt).toBeNull()
  })

  it("prefers user_id lookup strategy when linked user exists", () => {
    expect(getPromotionLookupStrategy("user-123")).toBe("user_id")
  })

  it("falls back to email lookup strategy when linked user is missing", () => {
    expect(getPromotionLookupStrategy(null)).toBe("email")
  })
})

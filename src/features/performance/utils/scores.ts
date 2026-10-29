import type { ScaleLevel } from '../types/performance.types'
import { formatNumber } from './format'

/** "4 · Exceeds Expectations" for a rating; "Not rated" without one. */
export function ratingText(scale: readonly ScaleLevel[], rating: number | null): string {
  if (rating === null) return 'Not rated'
  const level = scale.find((item) => item.score === rating)
  return level ? `${formatNumber(rating)} · ${level.label}` : formatNumber(rating)
}

/** The rating level a score reaches (the highest at or below it; the lowest below the scale). */
export function labelForScore(scale: readonly ScaleLevel[], score: number | null): string | null {
  if (score === null) return null
  return (
    [...scale].reverse().find((level) => level.score <= score)?.label ?? scale[0]?.label ?? null
  )
}

export type ReviewPart = 'self' | 'manager'

/**
 * Which review the signed-in person may write now: the self review while it is theirs, the
 * manager review once the self review is in and they are the reviewer; null otherwise.
 * `rights` are the permissions to save each (`performance.reviews.self` / `.manager`).
 */
export function writablePart(
  appraisal: { employeeId: string; reviewerId: string | null; status: string; cycleStatus: string },
  myId: string | null,
  rights: Record<ReviewPart, boolean> = { self: true, manager: true },
): ReviewPart | null {
  if (!myId || appraisal.cycleStatus !== 'active') return null
  if (rights.self && appraisal.status === 'self_review' && appraisal.employeeId === myId) {
    return 'self'
  }
  if (rights.manager && appraisal.status === 'manager_review' && appraisal.reviewerId === myId) {
    return 'manager'
  }
  return null
}

import { createMockCollection } from '../collection'
import {
  type ApplicantRec,
  type ApplicationRec,
  type EvaluationRec,
  type HistoryRec,
  type InterviewRec,
  type OfferRec,
  type OpeningRec,
  type ReasonRec,
  seedApplicants,
  seedApplications,
  seedEvaluations,
  seedHistory,
  seedInterviews,
  seedOffers,
  seedOpenings,
  seedReasons,
} from './seed'

// The Recruitment mock's tables, kept in sessionStorage in the browser like every mock.

const key = (name: string) => `hrms-mock-recruitment-${name}`

export const openings = createMockCollection<OpeningRec>({
  storageKey: key('openings'),
  seed: seedOpenings,
})
export const applicants = createMockCollection<ApplicantRec>({
  storageKey: key('applicants'),
  seed: seedApplicants,
})
export const applications = createMockCollection<ApplicationRec>({
  storageKey: key('applications'),
  seed: seedApplications,
})
export const history = createMockCollection<HistoryRec>({
  storageKey: key('history'),
  seed: seedHistory,
})
export const interviews = createMockCollection<InterviewRec>({
  storageKey: key('interviews'),
  seed: seedInterviews,
})
export const evaluations = createMockCollection<EvaluationRec>({
  storageKey: key('evaluations'),
  seed: seedEvaluations,
})
export const offers = createMockCollection<OfferRec>({
  storageKey: key('offers'),
  seed: seedOffers,
})
export const reasons = createMockCollection<ReasonRec>({
  storageKey: key('rejection-reasons'),
  seed: seedReasons,
})

/** Restores every table to its seed (tests, `resetMockDb`). */
export function resetRecruitmentCollections(): void {
  for (const collection of [
    openings,
    applicants,
    applications,
    history,
    interviews,
    evaluations,
    offers,
    reasons,
  ]) {
    collection.reset()
  }
}

/** The next numeric id of a table (`max + 1`, at least `floor`). */
export function nextId(rows: readonly { id: string }[], floor: number): string {
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), floor - 1)
  return String(highest + 1)
}

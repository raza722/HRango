import type { EndOfEmployment, OffboardingChecklist } from '@/features/offboarding'

import { createMockCollection } from '../collection'
import { seedChecklists, seedEndOfEmployments } from './seed'

const key = (name: string) => `hrms-mock-offboarding-${name}`

export const checklists = createMockCollection<OffboardingChecklist>({
  storageKey: key('checklists'),
  seed: seedChecklists,
})
export const endOfEmployments = createMockCollection<EndOfEmployment>({
  storageKey: key('end-of-employment'),
  seed: seedEndOfEmployments,
})

export function resetOffboardingDb(): void {
  checklists.reset()
  endOfEmployments.reset()
}

/** Fields of the active checklists: what the Checklist tab asks. */
export const activeChecklistFields = () =>
  checklists
    .all()
    .filter((item) => item.active)
    .flatMap((item) => item.fields.map((field) => ({ ...field, checklist: item.name })))

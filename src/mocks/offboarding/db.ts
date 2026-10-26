import type {
  ChecklistAnswerValue,
  ChecklistField,
  EoeReason,
  EoeStatus,
} from '@/features/offboarding'

import { createMockCollection } from '../collection'
import { seedChecklists, seedEndOfEmployments } from './seed'

/*
 * The mock's tables (sep.end_of_employment with its checklist answers, sep.offboarding_checklist
 * with its fields). The handlers turn them into the backend's shapes.
 */

/**
 * One end of employment. The first block is what the Requests mock writes when a resignation
 * is approved (keep these names); the optional ones are the backend's other columns.
 */
export interface StoredEndOfEmployment {
  id: string
  employeeId: string
  reason: EoeReason
  /** The Notice Period tick (serveNotice). */
  noticePeriod: boolean
  /** Set with a notice period; otherwise the day the record was made. */
  lastWorkingDate: string | null
  finalSettlement: boolean
  assetClearance: boolean
  /** A name only (the Requests mock); uploads set fileId. */
  attachmentName: string | null
  description: string
  delegateeId: string | null
  /** Checklist tab answers by field id. */
  checklist: Record<string, ChecklistAnswerValue>
  status: EoeStatus
  createdAt: string
  completedAt: string | null
  /** The Payroll Final Settlement it made (Final Settlement ticked). */
  finalSettlementId: string | null
  /** The Asset Clearance Form for it. */
  clearanceId: string | null
  rehire: { joiningDate: string; at: string } | null
  noticePeriodDays?: number | null
  assetClearByDate?: string | null
  replacementId?: string | null
  fileId?: string | null
  resignationRequestId?: string | null
  updatedAt?: string | null
  rowVersion?: string
}

export interface StoredChecklist {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  fields: ChecklistField[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

const key = (name: string) => `hrms-mock-offboarding-v2-${name}`

export const checklists = createMockCollection<StoredChecklist>({
  storageKey: key('checklists'),
  seed: seedChecklists,
})
export const endOfEmployments = createMockCollection<StoredEndOfEmployment>({
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
    .filter((item) => item.isActive)
    .flatMap((item) =>
      item.fields.map((field) => ({
        ...field,
        offboardingChecklistId: item.id,
        checklistName: item.name,
      })),
    )

/** A record's rowVersion (records written by other mocks may have none yet). */
export const versionOf = (record: { rowVersion?: string | undefined }) =>
  record.rowVersion ?? 'initial000000000'

import { createMockCollection } from '../collection'
import {
  DEFAULT_LEAVE_SETTINGS,
  seedEncashments,
  seedLeavePolicies,
  seedLeaveRequests,
  seedLeaveSettings,
  seedLeaveTypes,
  type StoredEncashment,
  type StoredLeavePolicy,
  type StoredLeaveRequest,
  type StoredLeaveSettings,
  type StoredLeaveType,
  type StoredLedgerEntry,
} from './seed'

/** Settings → Leave Types. */
export const leaveTypeStore = createMockCollection<StoredLeaveType>({
  storageKey: 'hrms-mock-leave-types-v2',
  seed: seedLeaveTypes,
})

/** Settings → Leave Policies, with their leave types and enrolments. */
export const leavePolicies = createMockCollection<StoredLeavePolicy>({
  storageKey: 'hrms-mock-leave-policies-v2',
  seed: seedLeavePolicies,
})

/** Settings → General Settings (one record). */
export const leaveSettingsStore = createMockCollection<StoredLeaveSettings>({
  storageKey: 'hrms-mock-leave-settings-v2',
  seed: seedLeaveSettings,
})

/** The leave ledger's credits and adjustments (the allotment run fills it). */
export const leaveLedger = createMockCollection<StoredLedgerEntry>({
  storageKey: 'hrms-mock-leave-ledger',
  seed: () => [],
})

/**
 * The leave requests the Leaves lists read. In the app the requests module owns them; this
 * mock keeps its own so the Leaves screens work alone (see `leaveRequestHandlers`).
 */
export const leaveRequests = createMockCollection<StoredLeaveRequest>({
  storageKey: 'hrms-mock-leave-requests',
  seed: seedLeaveRequests,
})

/** Leave encashments (Payroll → Leave Encashment calls `/leaves/encashments`). */
export const leaveEncashments = createMockCollection<StoredEncashment>({
  storageKey: 'hrms-mock-leave-encashments',
  seed: seedEncashments,
})

export function currentLeaveSettings(): StoredLeaveSettings {
  return leaveSettingsStore.find('settings') ?? DEFAULT_LEAVE_SETTINGS
}

/**
 * Compatibility for `src/mocks/requests` (Requests → Leave), which reads the leave types
 * under their earlier names (`active`, `deductible`).
 */
export const leaveTypes = {
  all: () => leaveTypeStore.all().map(withLegacyNames),
  find: (id: string) => {
    const found = leaveTypeStore.find(id)
    return found ? withLegacyNames(found) : undefined
  },
}

function withLegacyNames(type: StoredLeaveType) {
  return { ...type, active: type.isActive, deductible: type.isDeductible }
}

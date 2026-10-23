import type { LeaveSettings } from '@/features/leaves'

import { createMockCollection } from '../collection'
import {
  DEFAULT_LEAVE_SETTINGS,
  seedLeavePolicies,
  seedLeaveSettings,
  seedLeaveTypes,
  type StoredLeavePolicy,
  type StoredLeaveSettings,
  type StoredLeaveType,
} from './seed'

/** Settings → Leave Types. */
export const leaveTypes = createMockCollection<StoredLeaveType>({
  storageKey: 'hrms-mock-leave-types',
  seed: seedLeaveTypes,
})

/** Settings → Leave Policies, with their enrollments. */
export const leavePolicies = createMockCollection<StoredLeavePolicy>({
  storageKey: 'hrms-mock-leave-policies',
  seed: seedLeavePolicies,
})

/** Settings → General Settings (one record). */
export const leaveSettingsStore = createMockCollection<StoredLeaveSettings>({
  storageKey: 'hrms-mock-leave-settings',
  seed: seedLeaveSettings,
})

export function currentLeaveSettings(): StoredLeaveSettings {
  return leaveSettingsStore.find('settings') ?? DEFAULT_LEAVE_SETTINGS
}

/** The settings as the client sees them (without the record id). */
export function publicLeaveSettings(): LeaveSettings {
  const { finalApprovalBy, approveOnStatus, postDeadline } = currentLeaveSettings()
  return { finalApprovalBy, approveOnStatus, postDeadline }
}

/** Restores the Leaves tables to their seed data. */
export function resetLeavesDb(): void {
  leaveTypes.reset()
  leavePolicies.reset()
  leaveSettingsStore.reset()
}

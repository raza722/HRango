import { format, subDays } from 'date-fns'

import type { ChecklistField } from '@/features/offboarding'

import type { StoredChecklist, StoredEndOfEmployment } from './db'

const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
const stamp = (back: number, time = '10:30') => `${day(back)}T${time}:00.000Z`

const field = (
  id: string,
  name: string,
  fieldType: ChecklistField['fieldType'],
  sortOrder: number,
  extra: Partial<ChecklistField> = {},
): ChecklistField => ({
  id,
  name,
  fieldType,
  isRequired: false,
  minValue: null,
  maxValue: null,
  minLength: null,
  maxLength: null,
  sortOrder,
  ...extra,
})

/** "Off Boarding Checklist" (ECL-00001): what HR records before a leaver goes. */
export function seedChecklists(): StoredChecklist[] {
  return [
    {
      id: 'ecl_1',
      code: 'ECL-00001',
      name: 'Off Boarding Checklist',
      description: 'Steps HR checks before a leaver goes.',
      isActive: true,
      fields: [
        field('cf_access_card', 'Access Card Returned', 'date', 0, { isRequired: true }),
        field('cf_exit_interview', 'Exit Interview Done', 'boolean', 1),
        field('cf_notice_days', 'Notice Days Served', 'number', 2, { minValue: 0, maxValue: 90 }),
        field('cf_handover', 'Handover Notes', 'string', 3, { maxLength: 500 }),
      ],
      createdAt: stamp(300),
      updatedAt: null,
      rowVersion: 'seedecl100000000',
    },
  ]
}

/**
 * Payroll's two leavers: Talha Aziz (pending: his clearance is with HR and his
 * settlement is open) and Nida Hassan (completed). Dates match their Final
 * Settlements.
 */
export function seedEndOfEmployments(): StoredEndOfEmployment[] {
  return [
    {
      id: 'eoe_1',
      employeeId: 'em_talha',
      reason: 'resignation',
      noticePeriod: true,
      noticePeriodDays: 30,
      lastWorkingDate: day(15),
      finalSettlement: true,
      assetClearance: true,
      assetClearByDate: day(10),
      attachmentName: null,
      fileId: null,
      description: 'Moving abroad.',
      delegateeId: 'em_asad',
      replacementId: null,
      checklist: {
        cf_access_card: null,
        cf_exit_interview: true,
        cf_notice_days: 30,
        cf_handover: 'Deployment scripts handed to Asad Mehmood.',
      },
      status: 'pending',
      createdAt: stamp(45),
      completedAt: null,
      finalSettlementId: 'fs_talha',
      clearanceId: 'cf_2',
      rehire: null,
      updatedAt: null,
      rowVersion: 'seedeoe100000000',
    },
    {
      id: 'eoe_2',
      employeeId: 'em_nida',
      reason: 'resignation',
      noticePeriod: true,
      noticePeriodDays: 30,
      lastWorkingDate: day(50),
      finalSettlement: true,
      assetClearance: true,
      assetClearByDate: day(50),
      attachmentName: null,
      fileId: null,
      description: '',
      delegateeId: 'em_sana',
      replacementId: null,
      checklist: {
        cf_access_card: day(50),
        cf_exit_interview: true,
        cf_notice_days: 30,
        cf_handover: '',
      },
      status: 'completed',
      createdAt: stamp(80),
      completedAt: stamp(48, '16:20'),
      finalSettlementId: 'fs_nida',
      clearanceId: 'cf_1',
      rehire: null,
      updatedAt: stamp(48, '16:20'),
      rowVersion: 'seedeoe200000000',
    },
  ]
}

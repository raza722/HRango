import { format, subDays } from 'date-fns'

import type { EndOfEmployment, OffboardingChecklist } from '@/features/offboarding'

const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
const stamp = (back: number, time = '10:30') => `${day(back)}T${time}:00.000Z`

/** "Off Boarding Checklist" (ECL-00001): what HR records before a leaver goes. */
export function seedChecklists(): OffboardingChecklist[] {
  return [
    {
      id: 'ecl_1',
      code: 'ECL-00001',
      name: 'Off Boarding Checklist',
      active: true,
      description: 'Steps HR checks before a leaver goes.',
      fields: [
        {
          id: 'cf_asset_clear',
          name: 'Asset Clear',
          type: 'date',
          required: true,
          min: null,
          max: null,
        },
        {
          id: 'cf_exit_interview',
          name: 'Exit Interview Done',
          type: 'boolean',
          required: false,
          min: null,
          max: null,
        },
        {
          id: 'cf_notice_days',
          name: 'Notice Days Served',
          type: 'number',
          required: false,
          min: 0,
          max: 90,
        },
        {
          id: 'cf_handover',
          name: 'Handover Notes',
          type: 'string',
          required: false,
          min: null,
          max: 500,
        },
      ],
      createdAt: stamp(300),
    },
  ]
}

/**
 * Payroll's two leavers: Talha Aziz (pending: his clearance is with HR and his
 * settlement is open) and Nida Hassan (completed). Dates match their Final
 * Settlements.
 */
export function seedEndOfEmployments(): EndOfEmployment[] {
  return [
    {
      id: 'eoe_1',
      employeeId: 'em_talha',
      reason: 'resignation',
      noticePeriod: true,
      lastWorkingDate: day(15),
      finalSettlement: true,
      assetClearance: true,
      attachmentName: 'resignation-letter.pdf',
      description: 'Moving abroad.',
      delegateeId: 'em_asad',
      checklist: {
        cf_asset_clear: null,
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
    },
    {
      id: 'eoe_2',
      employeeId: 'em_nida',
      reason: 'resignation',
      noticePeriod: true,
      lastWorkingDate: day(50),
      finalSettlement: true,
      assetClearance: true,
      attachmentName: null,
      description: '',
      delegateeId: 'em_sana',
      checklist: {
        cf_asset_clear: day(50),
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
    },
  ]
}

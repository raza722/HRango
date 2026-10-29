import type { ComponentType, SVGProps } from 'react'

import {
  ConfigurationIcon,
  PayrollIcon,
  SeparationManagementIcon,
  SettingsIcon,
  TalentManagementIcon,
} from '@/components/icons/figma-icons'

export interface ModuleDefinition {
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * Screens planned for the module. Where the design folder (HRango2/Design)
   * has a screen, its folder name is used; the rest are placeholders to confirm.
   */
  plannedScreens: readonly string[]
}

/** Copy for the scaffolded (not yet built) modules. */
export const MODULES = {
  talentManagement: {
    title: 'Talent Management',
    description: 'Employee records, transfers and salary revisions.',
    icon: TalentManagementIcon,
    plannedScreens: [
      'Employees',
      'Bank Details',
      'Transfer',
      'Salary Revisions',
      'Employee Account',
    ],
  },
  separationManagement: {
    title: 'Separation Management',
    description: 'Resignations, clearances and final settlements.',
    icon: SeparationManagementIcon,
    plannedScreens: ['End of Employment', 'Asset Clearance Form', 'Approval', 'Final Settlement'],
  },
  payroll: {
    title: 'Payroll',
    description: 'Monthly and daily-wage payroll, payslips and vouchers.',
    icon: PayrollIcon,
    plannedScreens: [
      'Payroll Dashboard',
      'Monthly',
      'Daily Wages',
      'Payslip',
      'Vouchers',
      'Employee Voucher',
      'Leave Encashment',
    ],
  },
  configuration: {
    title: 'Configuration',
    description: 'Company assets, request types and setup checklists.',
    icon: ConfigurationIcon,
    plannedScreens: ['Assets', 'Asset Types', 'Request', 'Request Settings', 'Setting Checklist'],
  },
  settings: {
    title: 'Settings',
    description: 'Company profile, users, roles and reports.',
    icon: SettingsIcon,
    plannedScreens: ['Company', 'System Users', 'User Group Permissions', 'Reports'],
  },
} as const satisfies Record<string, ModuleDefinition>

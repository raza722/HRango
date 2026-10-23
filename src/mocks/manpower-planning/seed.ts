import type {
  Budget,
  BudgetDuration,
  DepartmentOption,
  EmployeePosition,
  NamedOption,
  OpenPosition,
  Plan,
  PositionTitle,
  Stamp,
  SubDepartmentOption,
} from '@/features/manpower-planning'

// Sample data as the Manpower Planning frames draw it: "Hamza Ashraf, HR Manager" made every
// record; Accounts, UI/UX Designer and Marketing budgets for 2024 with 5, 4 and 3 open
// positions; "Apps Planning" approved for 2025; Accountant (12212) as the employee position.

/** Local times, so "2024-01-16T12:30:00" reads "16 Jan 2024 12:30 PM" everywhere. */
const by = (at: string): Stamp => ({ at, byName: 'Hamza Ashraf', byRole: 'HR Manager' })

// --- organisation (the module's own lists; stations are Settings → Branches) ------------------

export const DIVISIONS: NamedOption[] = [
  { id: 'dv_corporate', name: 'Corporate' },
  { id: 'dv_technology', name: 'Technology' },
  { id: 'dv_healthcare', name: 'Healthcare' },
  { id: 'dv_commercial', name: 'Commercial' },
]

/** The company directory's departments, each under a division. */
export const DEPARTMENTS: DepartmentOption[] = [
  { id: 'dp_hrm', name: 'Human Resource Management', divisionId: 'dv_corporate' },
  { id: 'dp_finance', name: 'Finance', divisionId: 'dv_corporate' },
  { id: 'dp_operations', name: 'Operations', divisionId: 'dv_corporate' },
  { id: 'dp_software', name: 'Software', divisionId: 'dv_technology' },
  { id: 'dp_mobile', name: 'Mobile App', divisionId: 'dv_technology' },
  { id: 'dp_physio', name: 'Physiotherapy', divisionId: 'dv_healthcare' },
  { id: 'dp_surgery', name: 'Surgery', divisionId: 'dv_healthcare' },
  { id: 'dp_sales', name: 'Sales', divisionId: 'dv_commercial' },
  { id: 'dp_marketing', name: 'Marketing', divisionId: 'dv_commercial' },
]

const sub = (id: string, name: string, departmentId: string): SubDepartmentOption => ({
  id,
  name,
  departmentId,
})

export const SUB_DEPARTMENTS: SubDepartmentOption[] = [
  sub('sd_recruitment', 'Recruitment', 'dp_hrm'),
  sub('sd_relations', 'Employee Relations', 'dp_hrm'),
  sub('sd_accounts', 'Accounts', 'dp_finance'),
  sub('sd_audit', 'Audit', 'dp_finance'),
  sub('sd_payroll', 'Payroll', 'dp_finance'),
  sub('sd_admin', 'Administration', 'dp_operations'),
  sub('sd_facilities', 'Facilities', 'dp_operations'),
  sub('sd_development', 'Development', 'dp_software'),
  sub('sd_qa', 'Quality Assurance', 'dp_software'),
  sub('sd_design', 'Design', 'dp_mobile'),
  sub('sd_ios', 'iOS', 'dp_mobile'),
  sub('sd_android', 'Android', 'dp_mobile'),
  sub('sd_outpatient', 'Outpatient', 'dp_physio'),
  sub('sd_sports', 'Sports Rehab', 'dp_physio'),
  sub('sd_general', 'General Surgery', 'dp_surgery'),
  sub('sd_ortho', 'Orthopaedics', 'dp_surgery'),
  sub('sd_inside', 'Inside Sales', 'dp_sales'),
  sub('sd_field', 'Field Sales', 'dp_sales'),
  sub('sd_digital', 'Digital', 'dp_marketing'),
  sub('sd_brand', 'Brand', 'dp_marketing'),
]

export const EMPLOYEE_GROUPS: NamedOption[] = ['A', 'B', 'C', 'D'].map((name) => ({
  id: `eg_${name.toLowerCase()}`,
  name,
}))

export const GRADES: NamedOption[] = Array.from({ length: 8 }, (_, index) => ({
  id: `gr_${String(index + 1)}`,
  name: `Grade ${String(index + 1)}`,
}))

export const COST_CENTERS: NamedOption[] = [
  { id: 'cc_100', name: 'CC-100 Head Office' },
  { id: 'cc_200', name: 'CC-200 Technology' },
  { id: 'cc_300', name: 'CC-300 Clinical Services' },
  { id: 'cc_400', name: 'CC-400 Sales & Marketing' },
]

// --- E-Budget Settings ------------------------------------------------------------------------

export function seedDurations(): BudgetDuration[] {
  return [
    {
      id: 'bd_2026',
      name: '2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: false,
      added: by('2025-11-20T10:00:00'),
    },
    {
      id: 'bd_2025',
      name: '2025',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      isCurrent: true,
      added: by('2024-11-18T11:15:00'),
    },
    {
      id: 'bd_2024',
      name: '2024',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      isCurrent: false,
      added: by('2023-01-16T12:30:00'),
    },
  ]
}

export function seedPositionTitles(): PositionTitle[] {
  const title = (id: string, name: string, added: string, modified: string): PositionTitle => ({
    id,
    title: name,
    active: true,
    added: by(added),
    modified: by(modified),
  })
  return [
    title('pt_accounts', 'Accounts', '2023-12-16T12:30:00', '2024-01-20T21:00:00'),
    title('pt_uiux', 'UI/UX Designer', '2023-12-10T22:30:00', '2024-01-15T21:00:00'),
    title('pt_marketing', 'Marketing', '2023-12-08T10:00:00', '2024-01-12T09:30:00'),
    title('pt_accountant', 'Accountant', '2024-01-10T22:00:00', '2024-01-15T21:00:00'),
  ]
}

export function seedPositions(): EmployeePosition[] {
  const position = (
    id: string,
    code: string,
    positionTitleId: string,
    org: Pick<
      EmployeePosition,
      | 'divisionId'
      | 'stationId'
      | 'departmentId'
      | 'subDepartmentId'
      | 'employeeGroupId'
      | 'costCenterId'
      | 'gradeId'
      | 'reportsToId'
    >,
    minSalary: number,
    maxSalary: number,
    added: string,
    modified: string,
  ): EmployeePosition => ({
    id,
    code,
    positionTitleId,
    ...org,
    minSalary,
    maxSalary,
    active: true,
    added: by(added),
    modified: by(modified),
  })
  return [
    position(
      'ep_accountant',
      '12212',
      'pt_accountant',
      {
        divisionId: 'dv_corporate',
        stationId: 'br_lhr_ho',
        departmentId: 'dp_finance',
        subDepartmentId: 'sd_accounts',
        employeeGroupId: 'eg_a',
        costCenterId: 'cc_100',
        gradeId: 'gr_4',
        reportsToId: 'em_hina',
      },
      50000,
      100000,
      '2024-01-10T22:30:00',
      '2024-01-15T21:00:00',
    ),
    position(
      'ep_accounts',
      '12213',
      'pt_accounts',
      {
        divisionId: 'dv_corporate',
        stationId: 'br_lhr_ho',
        departmentId: 'dp_finance',
        subDepartmentId: 'sd_accounts',
        employeeGroupId: 'eg_b',
        costCenterId: 'cc_100',
        gradeId: 'gr_3',
        reportsToId: 'em_hina',
      },
      20000,
      25000,
      '2024-01-05T10:00:00',
      '2024-01-05T10:00:00',
    ),
    position(
      'ep_uiux',
      '12214',
      'pt_uiux',
      {
        divisionId: 'dv_technology',
        stationId: 'br_lhr_jt',
        departmentId: 'dp_mobile',
        subDepartmentId: 'sd_design',
        employeeGroupId: 'eg_a',
        costCenterId: 'cc_200',
        gradeId: 'gr_5',
        reportsToId: 'em_saad',
      },
      30000,
      45000,
      '2024-01-05T10:10:00',
      '2024-01-05T10:10:00',
    ),
    position(
      'ep_marketing',
      '12215',
      'pt_marketing',
      {
        divisionId: 'dv_commercial',
        stationId: 'br_khi',
        departmentId: 'dp_marketing',
        subDepartmentId: 'sd_digital',
        employeeGroupId: 'eg_b',
        costCenterId: 'cc_400',
        gradeId: 'gr_3',
        reportsToId: 'em_jack',
      },
      15000,
      20000,
      '2024-01-05T10:20:00',
      '2024-01-05T10:20:00',
    ),
  ]
}

// --- Planning ---------------------------------------------------------------------------------

const line = (
  id: string,
  positionId: string,
  fromMonth: string,
  toMonth: string,
  org: Pick<
    Plan['newPositions'][number],
    'divisionId' | 'stationId' | 'departmentId' | 'subDepartmentId' | 'employeeGroupId'
  >,
  minSalary: number,
  maxSalary: number,
  totalAllowance: number,
): Plan['newPositions'][number] => ({
  id,
  positionId,
  fromMonth,
  toMonth,
  ...org,
  minSalary,
  maxSalary,
  totalAllowance,
})

const finance = {
  divisionId: 'dv_corporate',
  stationId: 'br_lhr_ho',
  departmentId: 'dp_finance',
  subDepartmentId: 'sd_accounts',
  employeeGroupId: 'eg_b',
}
const design = {
  divisionId: 'dv_technology',
  stationId: 'br_lhr_jt',
  departmentId: 'dp_mobile',
  subDepartmentId: 'sd_design',
  employeeGroupId: 'eg_a',
}
const marketing = {
  divisionId: 'dv_commercial',
  stationId: 'br_khi',
  departmentId: 'dp_marketing',
  subDepartmentId: 'sd_digital',
  employeeGroupId: 'eg_b',
}

const repeat = <T>(count: number, make: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => make(index))

export function seedPlans(): Plan[] {
  return [
    {
      id: 'pl_apps',
      title: 'Apps Planning',
      durationId: 'bd_2025',
      divisionId: null,
      stationId: null,
      departmentId: 'dp_mobile',
      subDepartmentId: 'sd_design',
      employeeGroupId: 'eg_a',
      description: 'One more UI/UX designer for the app team in the first two months.',
      newPositions: [
        line('nl_apps_1', 'ep_uiux', '2025-01', '2025-02', design, 30000, 45000, 5000),
      ],
      existingPositions: [],
      status: 'approved',
      added: by('2023-01-16T12:30:00'),
      modified: by('2023-01-16T12:30:00'),
    },
    {
      id: 'pl_workforce',
      title: 'Workforce Plan 2024',
      durationId: 'bd_2024',
      divisionId: null,
      stationId: null,
      departmentId: null,
      subDepartmentId: null,
      employeeGroupId: null,
      description: 'Accounts, design and marketing hiring for 2024.',
      newPositions: [
        ...repeat(5, (index) =>
          line(
            `nl_wf_acc_${String(index)}`,
            'ep_accounts',
            '2024-01',
            '2024-12',
            finance,
            2500,
            2500,
            0,
          ),
        ),
        ...repeat(4, (index) =>
          line(`nl_wf_ux_${String(index)}`, 'ep_uiux', '2024-02', '2024-12', design, 2273, 2273, 0),
        ),
        ...repeat(3, (index) =>
          line(
            `nl_wf_mk_${String(index)}`,
            'ep_marketing',
            '2024-03',
            '2024-12',
            marketing,
            1667,
            1667,
            0,
          ),
        ),
      ],
      existingPositions: [],
      status: 'approved',
      added: by('2024-01-10T09:00:00'),
      modified: by('2024-01-10T09:00:00'),
    },
    {
      id: 'pl_finance',
      title: 'Finance Planning',
      durationId: 'bd_2025',
      divisionId: 'dv_corporate',
      stationId: 'br_lhr_ho',
      departmentId: 'dp_finance',
      subDepartmentId: 'sd_accounts',
      employeeGroupId: 'eg_a',
      description: 'Two accountants from March, and Omer Farooq kept on for the year.',
      newPositions: repeat(2, (index) =>
        line(
          `nl_fin_${String(index)}`,
          'ep_accountant',
          '2025-03',
          '2025-12',
          { ...finance, employeeGroupId: 'eg_a' },
          50000,
          100000,
          5000,
        ),
      ),
      existingPositions: [
        {
          id: 'xl_fin_omer',
          employeeId: 'em_omer',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          monthlySalary: 90000,
          totalAllowance: 5000,
        },
      ],
      status: 'pending',
      added: by('2025-02-12T10:30:00'),
      modified: by('2025-02-12T10:30:00'),
    },
  ]
}

// --- E-Budgeting and Open Positions -----------------------------------------------------------

export function seedBudgets(): Budget[] {
  const approved = by('2024-01-16T12:30:00')
  const budget = (
    id: string,
    planId: string,
    title: string,
    durationId: string,
    amount: number,
    startDate: string,
    endDate: string,
    positions: number,
    status: Budget['status'],
    added: Stamp,
    decided: Stamp | null,
  ): Budget => ({
    id,
    planId,
    title,
    durationId,
    amount,
    startDate,
    endDate,
    positions,
    status,
    added,
    decided,
  })
  return [
    budget(
      'bg_fin_accountant',
      'pl_finance',
      'Accountant',
      'bd_2025',
      3240000,
      '2025-01-01',
      '2025-12-31',
      2,
      'pending',
      by('2025-02-12T10:30:00'),
      null,
    ),
    budget(
      'bg_apps_uiux',
      'pl_apps',
      'UI/UX Designer',
      'bd_2025',
      100000,
      '2025-01-01',
      '2025-02-28',
      1,
      'active',
      by('2023-01-16T12:30:00'),
      by('2023-01-18T10:00:00'),
    ),
    budget(
      'bg_wf_accounts',
      'pl_workforce',
      'Accounts',
      'bd_2024',
      150000,
      '2024-01-01',
      '2024-12-31',
      5,
      'active',
      approved,
      approved,
    ),
    budget(
      'bg_wf_uiux',
      'pl_workforce',
      'UI/UX Designer',
      'bd_2024',
      100000,
      '2024-02-01',
      '2024-12-31',
      4,
      'active',
      approved,
      approved,
    ),
    budget(
      'bg_wf_marketing',
      'pl_workforce',
      'Marketing',
      'bd_2024',
      50000,
      '2024-03-01',
      '2024-12-31',
      3,
      'active',
      approved,
      approved,
    ),
  ]
}

export function seedOpenPositions(): OpenPosition[] {
  const approved = by('2024-01-16T12:30:00')
  const open = (
    id: string,
    budgetId: string,
    title: string,
    totalPositions: number,
    endDate: string,
    stamp: Stamp,
  ): OpenPosition => ({
    id,
    budgetId,
    title,
    totalPositions,
    endDate,
    approved: stamp,
    status: 'active',
  })
  return [
    open(
      'op_apps_uiux',
      'bg_apps_uiux',
      'UI/UX Designer',
      1,
      '2025-02-28',
      by('2023-01-18T10:00:00'),
    ),
    open('op_accounts', 'bg_wf_accounts', 'Accounts', 5, '2024-12-31', approved),
    open('op_uiux', 'bg_wf_uiux', 'UI/UX Designer', 4, '2024-12-31', approved),
    open('op_marketing', 'bg_wf_marketing', 'Marketing', 3, '2024-12-31', approved),
  ]
}

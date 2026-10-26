import type { BudgetRec, DurationRec, LineRec, OpenRec, PlanRec, PositionRec, RangeRec } from './db'

// Sample data as the Manpower Planning frames draw it: "Hamza Ashraf" made every record;
// Accounts, UI/UX Designer and Marketing budgets for 2024 with 5, 4 and 3 open positions;
// "Apps Planning" approved for 2025; "Finance Planning" waiting; Accountant (12212) as the
// employee position. Organisation's lists and people are in `org-lookups.ts`.

const BY = 'Hamza Ashraf'
const rv = (n: number) => `00000000000000${String(n).padStart(2, '0')}`

export function seedDurations(): DurationRec[] {
  const duration = (
    id: string,
    name: string,
    startDate: string,
    endDate: string,
    isCurrent: boolean,
    createdAt: string,
  ): DurationRec => ({
    id,
    name,
    startDate,
    endDate,
    isCurrent,
    createdAt,
    createdByName: BY,
    updatedAt: null,
    rowVersion: rv(1),
  })
  return [
    duration('bd_2026', '2026', '2026-01-01', '2026-12-31', false, '2025-11-20T10:00:00'),
    duration('bd_2025', '2025', '2025-01-01', '2025-12-31', true, '2024-11-18T11:15:00'),
    duration('bd_2024', '2024', '2024-01-01', '2024-12-31', false, '2023-01-16T12:30:00'),
  ]
}

export function seedPositions(): PositionRec[] {
  const position = (
    id: string,
    code: string,
    jobTitleId: string,
    org: Pick<
      PositionRec,
      | 'divisionId'
      | 'branchId'
      | 'departmentId'
      | 'subDepartmentId'
      | 'employeeGroupId'
      | 'costCenterId'
      | 'gradeId'
    >,
    createdAt: string,
  ): PositionRec => ({
    id,
    code,
    status: 'active',
    jobTitleId,
    ...org,
    reportsToId: null,
    employeeId: null,
    createdAt,
    createdByName: BY,
    updatedAt: null,
    updatedByName: null,
    rowVersion: rv(1),
  })
  const finance = {
    divisionId: 'dv_corporate',
    branchId: 'br_lhr_ho',
    departmentId: 'dp_finance',
    subDepartmentId: 'sd_accounts',
    costCenterId: 'cc_100',
  }
  return [
    position(
      'ep_accountant',
      '12212',
      'jt_accountant',
      { ...finance, employeeGroupId: 'eg_a', gradeId: 'gr_4' },
      '2024-01-10T22:30:00',
    ),
    position(
      'ep_accounts',
      '12213',
      'jt_accounts',
      { ...finance, employeeGroupId: 'eg_b', gradeId: 'gr_3' },
      '2024-01-05T10:00:00',
    ),
    position(
      'ep_uiux',
      '12214',
      'jt_uiux',
      {
        divisionId: 'dv_technology',
        branchId: 'br_lhr_jt',
        departmentId: 'dp_mobile',
        subDepartmentId: 'sd_design',
        employeeGroupId: 'eg_a',
        costCenterId: 'cc_200',
        gradeId: 'gr_5',
      },
      '2024-01-05T10:10:00',
    ),
    position(
      'ep_marketing',
      '12215',
      'jt_marketing',
      {
        divisionId: 'dv_commercial',
        branchId: 'br_khi',
        departmentId: 'dp_marketing',
        subDepartmentId: 'sd_digital',
        employeeGroupId: 'eg_b',
        costCenterId: null,
        gradeId: 'gr_3',
      },
      '2024-01-05T10:20:00',
    ),
  ]
}

export function seedRanges(): RangeRec[] {
  const range = (positionId: string, minSalary: number, maxSalary: number): RangeRec => ({
    id: `sr_${positionId}`,
    positionId,
    effectiveDate: '2024-01-01',
    minSalary,
    maxSalary,
    createdAt: '2024-01-05T10:00:00',
    createdByName: BY,
    rowVersion: rv(1),
  })
  return [
    range('ep_accountant', 50000, 100000),
    range('ep_accounts', 20000, 25000),
    range('ep_uiux', 30000, 45000),
    range('ep_marketing', 15000, 20000),
  ]
}

const newLine = (
  id: string,
  positionId: string,
  headcount: number,
  startDate: string,
  endDate: string,
  minSalary: number,
  maxSalary: number,
  totalAllowance: number,
  eBudgetId: string,
): LineRec => ({
  id,
  kind: 'new_position',
  positionId,
  employeeId: null,
  headcount,
  startDate,
  endDate,
  minSalary,
  maxSalary,
  monthlySalary: null,
  totalAllowance,
  eBudgetId,
})

export function seedPlans(): PlanRec[] {
  const plan = (
    rec: Omit<PlanRec, 'createdByName' | 'updatedAt' | 'updatedByName' | 'rowVersion'>,
  ) => ({
    ...rec,
    createdByName: BY,
    updatedAt: null,
    updatedByName: null,
    rowVersion: rv(1),
  })
  return [
    plan({
      id: 'pl_apps',
      title: 'Apps Planning',
      budgetDurationId: 'bd_2025',
      divisionId: null,
      branchId: null,
      departmentId: 'dp_mobile',
      subDepartmentId: 'sd_design',
      employeeGroupId: 'eg_a',
      description: 'One more UI/UX designer for the app team in the first two months.',
      status: 'approved',
      submittedAt: '2025-01-02T09:00:00',
      files: [],
      lines: [
        newLine(
          'nl_apps_1',
          'ep_uiux',
          1,
          '2025-01-01',
          '2025-02-28',
          30000,
          45000,
          5000,
          'bg_apps_uiux',
        ),
      ],
      createdAt: '2025-01-02T09:00:00',
    }),
    plan({
      id: 'pl_workforce',
      title: 'Workforce Plan 2024',
      budgetDurationId: 'bd_2024',
      divisionId: null,
      branchId: null,
      departmentId: null,
      subDepartmentId: null,
      employeeGroupId: null,
      description: 'Accounts, design and marketing hiring for 2024.',
      status: 'approved',
      submittedAt: '2024-01-10T09:00:00',
      files: [],
      lines: [
        newLine(
          'nl_wf_acc',
          'ep_accounts',
          5,
          '2024-01-01',
          '2024-12-31',
          2500,
          2500,
          0,
          'bg_wf_accounts',
        ),
        newLine('nl_wf_ux', 'ep_uiux', 4, '2024-02-01', '2024-12-31', 2273, 2273, 0, 'bg_wf_uiux'),
        newLine(
          'nl_wf_mk',
          'ep_marketing',
          3,
          '2024-03-01',
          '2024-12-31',
          1667,
          1667,
          0,
          'bg_wf_marketing',
        ),
      ],
      createdAt: '2024-01-10T09:00:00',
    }),
    plan({
      id: 'pl_finance',
      title: 'Finance Planning',
      budgetDurationId: 'bd_2025',
      divisionId: 'dv_corporate',
      branchId: 'br_lhr_ho',
      departmentId: 'dp_finance',
      subDepartmentId: 'sd_accounts',
      employeeGroupId: 'eg_a',
      description: 'Two accountants from March, and Omer Farooq kept on for the year.',
      status: 'pending',
      submittedAt: '2025-02-12T10:30:00',
      files: [
        {
          id: 'file_fin_plan',
          name: 'finance-plan.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 24000,
        },
      ],
      lines: [
        newLine(
          'nl_fin',
          'ep_accountant',
          2,
          '2025-03-01',
          '2025-12-31',
          50000,
          100000,
          5000,
          'bg_fin_accountant',
        ),
        {
          id: 'xl_fin_omer',
          kind: 'existing_employee',
          positionId: null,
          employeeId: 'em_omer',
          headcount: 1,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          minSalary: null,
          maxSalary: null,
          monthlySalary: 90000,
          totalAllowance: 5000,
          eBudgetId: 'bg_fin_accounts',
        },
      ],
      createdAt: '2025-02-12T10:30:00',
    }),
  ]
}

export function seedBudgets(): BudgetRec[] {
  const approvedAt = '2024-01-16T12:30:00'
  const budget = (
    rec: Omit<BudgetRec, 'createdByName' | 'updatedAt' | 'rowVersion' | 'remarks'>,
  ): BudgetRec => ({ ...rec, createdByName: BY, updatedAt: null, rowVersion: rv(1), remarks: null })
  return [
    budget({
      id: 'bg_fin_accountant',
      title: 'Accountant',
      budgetDurationId: 'bd_2025',
      manpowerPlanId: 'pl_finance',
      jobTitleId: 'jt_accountant',
      departmentId: 'dp_finance',
      amount: 2100000,
      totalPositions: 2,
      startDate: '2025-03-01',
      endDate: '2025-12-31',
      status: 'pending',
      decidedByName: null,
      decidedAt: null,
      createdAt: '2025-02-12T10:30:00',
    }),
    budget({
      id: 'bg_fin_accounts',
      title: 'Accounts',
      budgetDurationId: 'bd_2025',
      manpowerPlanId: 'pl_finance',
      jobTitleId: 'jt_accounts',
      departmentId: 'dp_finance',
      amount: 1140000,
      totalPositions: 0,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      status: 'pending',
      decidedByName: null,
      decidedAt: null,
      createdAt: '2025-02-12T10:30:00',
    }),
    budget({
      id: 'bg_apps_uiux',
      title: 'UI/UX Designer',
      budgetDurationId: 'bd_2025',
      manpowerPlanId: 'pl_apps',
      jobTitleId: 'jt_uiux',
      departmentId: 'dp_mobile',
      amount: 100000,
      totalPositions: 1,
      startDate: '2025-01-01',
      endDate: '2025-02-28',
      status: 'approved',
      decidedByName: BY,
      decidedAt: '2025-01-03T10:00:00',
      createdAt: '2025-01-02T09:00:00',
    }),
    budget({
      id: 'bg_wf_accounts',
      title: 'Accounts',
      budgetDurationId: 'bd_2024',
      manpowerPlanId: 'pl_workforce',
      jobTitleId: 'jt_accounts',
      departmentId: 'dp_finance',
      amount: 150000,
      totalPositions: 5,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'approved',
      decidedByName: BY,
      decidedAt: approvedAt,
      createdAt: '2024-01-10T09:00:00',
    }),
    budget({
      id: 'bg_wf_uiux',
      title: 'UI/UX Designer',
      budgetDurationId: 'bd_2024',
      manpowerPlanId: 'pl_workforce',
      jobTitleId: 'jt_uiux',
      departmentId: 'dp_mobile',
      amount: 100000,
      totalPositions: 4,
      startDate: '2024-02-01',
      endDate: '2024-12-31',
      status: 'approved',
      decidedByName: BY,
      decidedAt: approvedAt,
      createdAt: '2024-01-10T09:00:00',
    }),
    budget({
      id: 'bg_wf_marketing',
      title: 'Marketing',
      budgetDurationId: 'bd_2024',
      manpowerPlanId: 'pl_workforce',
      jobTitleId: 'jt_marketing',
      departmentId: 'dp_marketing',
      amount: 50000,
      totalPositions: 3,
      startDate: '2024-03-01',
      endDate: '2024-12-31',
      status: 'approved',
      decidedByName: BY,
      decidedAt: approvedAt,
      createdAt: '2024-01-10T09:00:00',
    }),
  ]
}

export function seedOpenPositions(): OpenRec[] {
  const open = (
    id: string,
    eBudgetId: string,
    lineId: string,
    positionId: string,
    title: string,
    jobTitleId: string,
    departmentId: string,
    branchId: string,
    total: number,
    endDate: string,
    approvedAt: string,
    jd: boolean,
  ): OpenRec => ({
    id,
    title,
    eBudgetId,
    manpowerPlanLineId: lineId,
    positionId,
    jobTitleId,
    departmentId,
    branchId,
    approvedPositions: total,
    totalPositions: total,
    endDate,
    jdFile: jd
      ? {
          id: `file_jd_${id}`,
          name: `${title} JD.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 18000,
        }
      : null,
    status: 'active',
    approvedAt,
    approvedByName: BY,
    createdAt: approvedAt,
    updatedAt: null,
    rowVersion: rv(1),
  })
  const approvedAt = '2024-01-16T12:30:00'
  return [
    open(
      'op_apps_uiux',
      'bg_apps_uiux',
      'nl_apps_1',
      'ep_uiux',
      'UI/UX Designer',
      'jt_uiux',
      'dp_mobile',
      'br_lhr_jt',
      1,
      '2025-02-28',
      '2025-01-03T10:00:00',
      false,
    ),
    open(
      'op_accounts',
      'bg_wf_accounts',
      'nl_wf_acc',
      'ep_accounts',
      'Accounts',
      'jt_accounts',
      'dp_finance',
      'br_lhr_ho',
      5,
      '2024-12-31',
      approvedAt,
      true,
    ),
    open(
      'op_uiux',
      'bg_wf_uiux',
      'nl_wf_ux',
      'ep_uiux',
      'UI/UX Designer',
      'jt_uiux',
      'dp_mobile',
      'br_lhr_jt',
      4,
      '2024-12-31',
      approvedAt,
      false,
    ),
    open(
      'op_marketing',
      'bg_wf_marketing',
      'nl_wf_mk',
      'ep_marketing',
      'Marketing',
      'jt_marketing',
      'dp_marketing',
      'br_khi',
      3,
      '2024-12-31',
      approvedAt,
      false,
    ),
  ]
}

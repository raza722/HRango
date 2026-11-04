import type { LoginInput } from '@/features/auth'
import { platformClient } from '@/lib/axios'
import type { StaffRole, StaffSession, StaffUser } from '@/stores/platform-store'
import type { ApiItem, Paginated } from '@/types/api'

export interface StaffRow extends StaffUser {
  isActive: boolean
  lastLoginAt: string | null
  rowVersion: string
}

export interface StaffOption {
  id: string
  displayName: string
  role: StaffRole
}

export interface StaffAuditRow {
  id: string
  actionName: string
  entityType: string | null
  entityRef: string | null
  detail: string | null
  staffName: string | null
  createdAt: string
}

export interface Organisation {
  id: string
  name: string
  contactName: string | null
  contactEmail: string
  contactPhone: string | null
  country: string | null
  status: string
  notes: string | null
  companyCount: number
  employeeCount: number
  planName: string | null
  subscriptionStatus: string | null
  renewsOn: string | null
  createdAt: string
  rowVersion: string
}

export interface OrganisationCompany {
  id: string
  name: string
  isActive: boolean
  employeeCount: number
}

export interface Plan {
  id: string
  name: string
  description: string | null
  priceMonthly: number
  priceAnnual: number
  employeeLimit: number | null
  isActive: boolean
  subscriptionCount: number
  rowVersion: string
}

export interface Subscription {
  id: string
  customerId: string
  customerName: string
  planId: string
  planName: string
  billingCycle: string
  status: string
  amount: number
  startDate: string
  renewsOn: string | null
  cancelledOn: string | null
  rowVersion: string
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  issueDate: string
  dueDate: string
  amount: number
  status: string
  paidOn: string | null
  paymentReference: string | null
  rowVersion: string
}

export interface Lead {
  id: string
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  source: string | null
  stage: string
  employeeCount: number | null
  expectedMonthly: number | null
  nextFollowUp: string | null
  notes: string | null
  ownerStaffId: string | null
  ownerName: string | null
  customerId: string | null
  rowVersion: string
}

export interface Ticket {
  id: string
  customerId: string
  customerName: string
  subject: string
  detail: string | null
  priority: string
  status: string
  assigneeStaffId: string | null
  assigneeName: string | null
  resolvedAt: string | null
  createdAt: string
  rowVersion: string
}

export interface PlatformDashboard {
  figures: {
    organisations: number
    activeOrganisations: number
    suspendedOrganisations: number
    cancelledOrganisations: number
    newThisMonth: number
    employees: number
    trials: number
    payingSubscriptions: number
    pastDueSubscriptions: number
    openLeads: number
    openTickets: number
    urgentTickets: number
    monthlyRevenue: number | null
    overdueInvoices: number | null
    overdueAmount: number | null
    paidThisMonth: number | null
    pipelineMonthly: number | null
  }
  months: { month: string; organisations: number }[]
  plans: { plan: string; subscriptions: number }[]
  stages: { stage: string; leads: number; monthly: number | null }[]
  renewals: {
    id: string
    customerId: string
    customerName: string
    planName: string
    status: string
    renewsOn: string
    amount: number | null
  }[]
}

export type ListParams = Record<string, string | number | undefined>

async function item<T>(request: Promise<{ data: ApiItem<T> }>): Promise<T> {
  return (await request).data.data
}

export const platformApi = {
  login: (input: LoginInput) =>
    item<StaffSession>(platformClient.post('/platform/auth/login', input)),

  async logout(): Promise<void> {
    await platformClient.post('/platform/auth/logout')
  },

  dashboard: (signal?: AbortSignal) =>
    item<PlatformDashboard>(platformClient.get('/platform/dashboard', { signal })),

  /** Any paginated list under `/platform`. */
  async list<T>(path: string, params: ListParams, signal?: AbortSignal): Promise<Paginated<T>> {
    const { data } = await platformClient.get<Paginated<T>>(`/platform/${path}`, { params, signal })
    return data
  },

  get: <T>(path: string, signal?: AbortSignal) =>
    item<T>(platformClient.get(`/platform/${path}`, { signal })),

  create: <T>(path: string, body: object) =>
    item<T>(platformClient.post(`/platform/${path}`, body)),

  update: <T>(path: string, body: object) => item<T>(platformClient.put(`/platform/${path}`, body)),

  patch: <T>(path: string, body: object) =>
    item<T>(platformClient.patch(`/platform/${path}`, body)),

  async setStaffPassword(id: string, password: string): Promise<void> {
    await platformClient.put(`/platform/staff/${id}/password`, { password })
  },
}

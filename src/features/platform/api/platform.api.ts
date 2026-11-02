import type { LoginInput } from '@/features/auth'
import { platformClient } from '@/lib/axios'
import type { StaffRole, StaffSession, StaffUser } from '@/stores/platform-store'
import type { ApiItem, Paginated } from '@/types/api'

export interface StaffRow extends StaffUser {
  role: StaffRole
  isActive: boolean
  lastLoginAt: string | null
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

export const platformApi = {
  async login(input: LoginInput): Promise<StaffSession> {
    const { data } = await platformClient.post<ApiItem<StaffSession>>('/platform/auth/login', input)
    return data.data
  },

  async logout(): Promise<void> {
    await platformClient.post('/platform/auth/logout')
  },

  async staff(signal?: AbortSignal): Promise<StaffRow[]> {
    const { data } = await platformClient.get<Paginated<StaffRow>>('/platform/staff', {
      params: { pageSize: 100 },
      signal,
    })
    return data.data
  },

  async audit(signal?: AbortSignal): Promise<StaffAuditRow[]> {
    const { data } = await platformClient.get<Paginated<StaffAuditRow>>('/platform/audit', {
      params: { pageSize: 25 },
      signal,
    })
    return data.data
  },
}

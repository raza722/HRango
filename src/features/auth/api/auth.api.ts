import { apiClient } from '@/lib/axios'
import type { ApiItem } from '@/types/api'
import type { AuthSession, AuthUser } from '@/types/auth'

import type { LoginInput } from '../schemas/login.schema'

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiItem<AuthSession>>('/auth/login', input)
    return data.data
  },

  async me(signal?: AbortSignal): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiItem<AuthUser>>('/auth/me', { signal })
    return data.data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },
}

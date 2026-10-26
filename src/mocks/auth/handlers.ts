import { http, HttpResponse } from 'msw'

import companyLogoUrl from '@/assets/brand/logo-top-edge.svg'
import avatarUrl from '@/assets/images/avatar-shelley-kannes.png'
import { DEMO_ACCOUNT } from '@/features/auth'
import type { ApiItem } from '@/types/api'
import type { AuthSession, AuthUser } from '@/types/auth'

import {
  apiPath,
  errorResponse,
  latency,
  MOCK_TOKEN_PREFIX,
  randomHex,
  requireAuth,
} from '../utils'

/** The signed-in person drawn in every Figma frame. */
export const DEMO_USER: AuthUser = {
  id: 'usr_shelley',
  name: 'Shelley Kannes',
  email: DEMO_ACCOUNT.email,
  role: 'HR Manager',
  avatarUrl,
  employeeId: 'em_shelley',
  // The demo tenant: the organisation using hRango in mock mode.
  companyName: 'Top Edge Technologies',
  companyLogoUrl,
}

interface LoginBody {
  email?: unknown
  password?: unknown
}

export const authHandlers = [
  http.post(apiPath('/auth/login'), async ({ request }) => {
    await latency()
    const body = (await request.json().catch(() => ({}))) as LoginBody
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (email !== DEMO_ACCOUNT.email || password !== DEMO_ACCOUNT.password) {
      return errorResponse(401, 'Incorrect email or password.', { code: 'INVALID_CREDENTIALS' })
    }
    return HttpResponse.json<ApiItem<AuthSession>>({
      data: { token: `${MOCK_TOKEN_PREFIX}${randomHex()}`, user: DEMO_USER },
    })
  }),

  http.get(apiPath('/auth/me'), async ({ request }) => {
    await latency()
    return requireAuth(request) ?? HttpResponse.json<ApiItem<AuthUser>>({ data: DEMO_USER })
  }),

  http.post(apiPath('/auth/logout'), () => new HttpResponse(null, { status: 204 })),
]

/** One permission the signed-in person holds, with how far it reaches. */
export interface Permission {
  /** module.screen.action, e.g. `requests.leave.create`. */
  code: string
  /** own | team | department | branch | selected_units | company */
  scope: string
}

/** The signed-in person, as returned by `POST /auth/login` and `GET /auth/me`. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  /** The active company (send `X-Company-Id` to switch). */
  companyId?: string
  /** The organisation using hRango: its name and logo (signed link) head the sidebar. */
  companyName?: string | null
  companyLogoUrl?: string | null
  employeeId?: string | null
  /** Everything the user may do in the active company; screens and buttons hide what is missing. */
  permissions?: Permission[]
}

export interface AuthSession {
  token: string
  user: AuthUser
}

/** The signed-in person, as returned by `POST /auth/login` and `GET /auth/me`. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

export interface AuthSession {
  token: string
  user: AuthUser
}

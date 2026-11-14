import type { AuthSession, User } from '@/types'
import { IS_MOCK } from '@/utils/constants'
import { readAccounts, writeAccounts } from '@/services/authStorage'
import { titleCase } from '@/utils/format'
import { ApiError, api, simulateLatency } from './axios'

function encodeToken(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload)).replace(/=+$/, '')
}

function makeUser(email: string, name: string): User {
  const id = `usr-${btoa(email).replace(/[^a-z0-9]/gi, '').slice(0, 12)}`
  return {
    id,
    name,
    email,
    role: 'owner',
    createdAt: new Date(Date.now() - 42 * 86_400_000).toISOString(),
  }
}

function issueSession(user: User): AuthSession {
  return {
    accessToken: encodeToken({ sub: user.id, email: user.email, iat: Date.now() }),
    user,
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ')
  return titleCase(local || 'Operator')
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (!IS_MOCK) {
    const { data } = await api.post<AuthSession>('/auth/login', { email, password })
    return data
  }

  await simulateLatency(320)
  if (password.length < 8) {
    throw new ApiError('Invalid credentials — password must be at least 8 characters', 401)
  }

  const accounts = readAccounts()
  const account = accounts.find((a) => a.user.email.toLowerCase() === email.toLowerCase())

  if (account) {
    if (account.password !== password) {
      throw new ApiError('Invalid email or password', 401)
    }
    return issueSession(account.user)
  }

  // Mock mode self-registers the first sign-in so the demo needs no seeded secrets.
  const user = makeUser(email, nameFromEmail(email))
  writeAccounts([...accounts, { user, password }])
  return issueSession(user)
}

export async function register(name: string, email: string, password: string): Promise<AuthSession> {
  if (!IS_MOCK) {
    const { data } = await api.post<AuthSession>('/auth/register', { name, email, password })
    return data
  }

  await simulateLatency(380)
  const accounts = readAccounts()
  if (accounts.some((a) => a.user.email.toLowerCase() === email.toLowerCase())) {
    throw new ApiError('An account with this email already exists', 409)
  }
  const user = makeUser(email, name)
  writeAccounts([...accounts, { user, password }])
  return issueSession(user)
}

export async function me(): Promise<User> {
  if (!IS_MOCK) {
    const { data } = await api.get<User>('/auth/me')
    return data
  }
  await simulateLatency(120)
  const session = localStorage.getItem('coolsense:v1:session')
  if (!session) throw new ApiError('Session expired', 401)
  return (JSON.parse(session) as AuthSession).user
}

export async function logout(): Promise<void> {
  if (!IS_MOCK) {
    await api.post('/auth/logout').catch(() => undefined)
  }
}

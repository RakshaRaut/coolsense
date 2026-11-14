import type { AuthSession, User } from '@/types'

const SESSION_KEY = 'coolsense:v1:session'
const USERS_KEY = 'coolsense:v1:users'

export interface StoredAccount {
  user: User
  password: string
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession & { expiresAt?: number }
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { accessToken: parsed.accessToken, user: parsed.user }
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession, ttlMs = 12 * 60 * 60 * 1000): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + ttlMs }))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function getToken(): string | null {
  return getSession()?.accessToken ?? null
}

export function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as StoredAccount[]) : []
  } catch {
    return []
  }
}

export function writeAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(accounts))
}

export function updateStoredUser(user: User): void {
  const accounts = readAccounts().map((account) =>
    account.user.id === user.id ? { ...account, user } : account,
  )
  writeAccounts(accounts)
  const session = getSession()
  if (session) saveSession({ ...session, user })
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthSession, User } from '@/types'
import * as authApi from '@/api/auth.api'
import { clearSession, getSession, saveSession, updateStoredUser } from '@/services/authStorage'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<Pick<User, 'name' | 'email'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getSession())

  const apply = useCallback((next: AuthSession) => {
    saveSession(next)
    setSession(next)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await authApi.login(email.toLowerCase().trim(), password)
      apply(next)
    },
    [apply],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const next = await authApi.register(name.trim(), email.toLowerCase().trim(), password)
      apply(next)
    },
    [apply],
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    clearSession()
    setSession(null)
  }, [])

  const updateProfile = useCallback((patch: Partial<Pick<User, 'name' | 'email'>>) => {
    setSession((prev) => {
      if (!prev) return prev
      const user = { ...prev.user, ...patch }
      saveSession({ ...prev, user })
      updateStoredUser(user)
      return { ...prev, user }
    })
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession()
      setSession(null)
    }
    window.addEventListener('coolsense:unauthorized', onUnauthorized)
    return () => window.removeEventListener('coolsense:unauthorized', onUnauthorized)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.accessToken ?? null,
      isAuthenticated: Boolean(session),
      login,
      register,
      logout,
      updateProfile,
    }),
    [session, login, register, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

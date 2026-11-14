import axios, { AxiosError } from 'axios'
import { API_URL } from '@/utils/constants'
import { clearSession, getToken } from '@/services/authStorage'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status = 0, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    const status = error.response?.status ?? 0

    if (status === 401) {
      clearSession()
      window.dispatchEvent(new CustomEvent('coolsense:unauthorized'))
    }

    const raw = error.response?.data?.message
    const message =
      (Array.isArray(raw) ? raw.join(', ') : raw) ??
      (status === 0 ? 'Cannot reach the CoolSense backend. Check your connection.' : error.message)

    return Promise.reject(new ApiError(message, status, error.response?.data))
  },
)

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function simulateLatency(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

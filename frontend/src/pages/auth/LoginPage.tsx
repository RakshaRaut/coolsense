import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthProvider'
import { errorMessage } from '@/api/axios'
import { IS_MOCK } from '@/utils/constants'
import { Button } from '@/components/common/Button'
import { Field, Input, InputGroup } from '@/components/common/Input'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to monitor your virtual AC fleet and continue your experiments."
      footer={
        <>
          New to CoolSense?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-[12px] leading-5 text-fg-soft">{serverError}</p>
          </div>
        ) : null}

        <Field label="Email address" error={errors.email?.message} htmlFor="email" required>
          <InputGroup icon={<Mail className="size-3.5" />}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="pl-9"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </InputGroup>
        </Field>

        <Field label="Password" error={errors.password?.message} htmlFor="password" required>
          <div className="relative">
            <InputGroup icon={<Lock className="size-3.5" />}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-10 pl-9"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </InputGroup>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:text-fg"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </Field>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting} iconRight={<ArrowRight className="size-4" />}>
          Sign in
        </Button>

        {IS_MOCK ? (
          <p className="rounded-lg border border-line bg-card-2 px-3 py-2.5 text-center text-[11px] leading-5 text-muted">
            <span className="font-semibold text-warning">Mock mode</span> — no backend is configured.
            Any email with an 8+ character password signs you in locally.
          </p>
        ) : null}
      </form>
    </AuthLayout>
  )
}

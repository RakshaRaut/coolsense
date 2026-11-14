import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthProvider'
import { errorMessage } from '@/api/axios'
import { Button } from '@/components/common/Button'
import { Field, Input, InputGroup } from '@/components/common/Input'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    name: z.string().min(2, 'Please enter your full name'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await registerUser(values.name, values.email, values.password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Spin up a simulated AC fleet in seconds — no hardware, no wiring."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
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

        <Field label="Full name" error={errors.name?.message} htmlFor="name" required>
          <InputGroup icon={<UserRound className="size-3.5" />}>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              className="pl-9"
              invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </InputGroup>
        </Field>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message} htmlFor="password" required>
            <div className="relative">
              <InputGroup icon={<Lock className="size-3.5" />}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="8+ characters"
                  className="pr-9 pl-9"
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
          <Field label="Confirm" error={errors.confirmPassword?.message} htmlFor="confirm" required>
            <InputGroup icon={<Lock className="size-3.5" />}>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                className="pl-9"
                invalid={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
            </InputGroup>
          </Field>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting} iconRight={<ArrowRight className="size-4" />}>
          Create account
        </Button>

        <p className="text-[10.5px] leading-5 text-muted">
          By creating an account you agree that CoolSense is a simulation environment and all values are
          modelled estimates.
        </p>
      </form>
    </AuthLayout>
  )
}

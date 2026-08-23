'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginSchema, LoginInput } from '@/server/validation/auth.schema'
import { Input, Label, Button } from '@roomlink/ui'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formError, setFormError] = useState<string | null>(
    searchParams?.get('error') === 'forbidden' ? 'Your account does not have Hotel Admin portal access.' : null
  )
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    const result = await signIn('credentials', { ...values, redirect: false })
    submittingRef.current = false
    setSubmitting(false)

    if (result?.error) {
      setFormError(result.error.startsWith('Too many') ? result.error : 'Incorrect email or password.')
      return
    }

    // Let the root page decide the destination server-side (role-aware — see app/page.tsx)
    // instead of hard-coding the hotel-wide dashboard here.
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {formError}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@hotel.com"
          disabled={submitting}
          {...register('email')}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={submitting}
          {...register('password')}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

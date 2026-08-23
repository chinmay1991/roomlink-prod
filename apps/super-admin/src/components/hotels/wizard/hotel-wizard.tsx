'use client'

import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createHotelSchema, CreateHotelInput, createHotelStepFields } from '@/server/validation/hotel.schema'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { StepBasic } from './step-basic'
import { StepContact } from './step-contact'
import { StepPlan, PlanOption } from './step-plan'
import { StepAdmin } from './step-admin'
import { StepReview } from './step-review'

const STEPS = [
  { id: 1, label: 'Basic Information' },
  { id: 2, label: 'Contact Details' },
  { id: 3, label: 'Subscription Plan' },
  { id: 4, label: 'Create Hotel Admin' },
  { id: 5, label: 'Review & Create' },
] as const

type CreatedResult = { hotelId: string; adminEmail: string; adminTempPassword: string }

export function HotelWizard({ plans }: { plans: PlanOption[] }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedResult | null>(null)

  const form = useForm<CreateHotelInput>({
    resolver: zodResolver(createHotelSchema),
    defaultValues: {
      timeZone: 'Asia/Kolkata',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      country: 'India',
      trialDays: 14,
    },
  })

  async function goNext() {
    const fields = createHotelStepFields[step as 1 | 2 | 3 | 4]
    const valid = await form.trigger(fields)
    if (valid) setStep((s) => s + 1)
  }

  async function onSubmit(values: CreateHotelInput) {
    setSubmitting(true)
    setServerError(null)
    const res = await fetch('/api/v1/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setServerError(body.error ?? 'Could not create the hotel.')
      setSubmitting(false)
      return
    }
    setCreated(await res.json())
    setSubmitting(false)
  }

  if (created) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hotel created</h2>
            <p className="text-sm text-slate-500">
              An invite email with these credentials was sent to the Hotel Admin. You can also share them manually
              below.
            </p>
          </div>
          <div className="rounded-md bg-slate-50 p-4 text-left text-sm">
            <p>
              <span className="text-slate-500">Email: </span>
              <span className="font-mono text-slate-900">{created.adminEmail}</span>
            </p>
            <p>
              <span className="text-slate-500">Temporary password: </span>
              <span className="font-mono text-slate-900">{created.adminTempPassword}</span>
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => router.push('/hotels')}>
              Back to Hotels
            </Button>
            <Button onClick={() => router.push(`/hotels/${created.hotelId}`)}>View hotel</Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto max-w-2xl space-y-6">
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                    step === s.id
                      ? 'bg-brand-600 text-white'
                      : step > s.id
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {s.id}
                </span>
                <span className={cn('hidden text-xs sm:block', step === s.id ? 'text-slate-900' : 'text-slate-400')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={cn('mx-2 h-px flex-1', step > s.id ? 'bg-brand-300' : 'bg-slate-200')} />}
            </li>
          ))}
        </ol>

        <Card>
          <CardBody>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">{STEPS[step - 1].label}</h2>

            {step === 1 && <StepBasic />}
            {step === 2 && <StepContact />}
            {step === 3 && <StepPlan plans={plans} />}
            {step === 4 && <StepAdmin />}
            {step === 5 && <StepReview plans={plans} />}

            {serverError && (
              <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {serverError}
              </div>
            )}

            <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
                Back
              </Button>
              {step < 5 ? (
                <Button onClick={goNext}>Next</Button>
              ) : (
                <Button onClick={form.handleSubmit(onSubmit)} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create hotel'}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </FormProvider>
  )
}

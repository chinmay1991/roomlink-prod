'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Input, Button, FormField, Card, CardBody, CardHeader } from '@roomlink/ui'
import { updateHotelProfileSchema, UpdateHotelProfileInput } from '@/server/validation/hotel-profile.schema'

export function ProfileForm({ initial }: { initial: UpdateHotelProfileInput }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateHotelProfileInput>({ resolver: zodResolver(updateHotelProfileSchema), defaultValues: initial })

  async function onSubmit(values: UpdateHotelProfileInput) {
    setSubmitting(true)
    setBanner(null)
    const res = await fetch('/api/v1/hotel/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSubmitting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setBanner({ type: 'error', text: data.error ?? 'Something went wrong.' })
      return
    }
    setBanner({ type: 'success', text: 'Hotel profile saved.' })
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {banner && (
        <div
          role="alert"
          className={
            banner.type === 'success'
              ? 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
              : 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
          }
        >
          {banner.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Hotel identity</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Hotel name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" {...register('name')} />
          </FormField>
          <FormField label="Brand" htmlFor="brand" error={errors.brand?.message}>
            <Input id="brand" {...register('brand')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description" htmlFor="description" error={errors.description?.message}>
              <textarea
                id="description"
                rows={3}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                {...register('description')}
              />
            </FormField>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Address & contact</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Address" htmlFor="addressLine" error={errors.addressLine?.message}>
              <Input id="addressLine" {...register('addressLine')} />
            </FormField>
          </div>
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </FormField>
          <FormField label="State" htmlFor="state" error={errors.state?.message}>
            <Input id="state" {...register('state')} />
          </FormField>
          <FormField label="Pincode" htmlFor="pincode" error={errors.pincode?.message}>
            <Input id="pincode" {...register('pincode')} />
          </FormField>
          <FormField label="Country" htmlFor="country" required error={errors.country?.message}>
            <Input id="country" {...register('country')} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </FormField>
          <FormField
            label="Reception Contact Number"
            htmlFor="receptionContact"
            required
            error={errors.receptionContact?.message}
          >
            <Input id="receptionContact" {...register('receptionContact')} />
          </FormField>
          <FormField
            label="Room Service Contact Number"
            htmlFor="roomServiceContact"
            required
            error={errors.roomServiceContact?.message}
          >
            <Input id="roomServiceContact" {...register('roomServiceContact')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          <FormField label="Website" htmlFor="website" error={errors.website?.message}>
            <Input id="website" {...register('website')} />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Operating times</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Timezone" htmlFor="timeZone" required error={errors.timeZone?.message}>
            <Input id="timeZone" {...register('timeZone')} />
          </FormField>
          <div />
          <FormField label="Check-in time" htmlFor="checkInTime" required error={errors.checkInTime?.message}>
            <Input id="checkInTime" type="time" {...register('checkInTime')} />
          </FormField>
          <FormField label="Check-out time" htmlFor="checkOutTime" required error={errors.checkOutTime?.message}>
            <Input id="checkOutTime" type="time" {...register('checkOutTime')} />
          </FormField>
          <FormField label="Breakfast timing" htmlFor="breakfastTime" error={errors.breakfastTime?.message}>
            <Input id="breakfastTime" type="time" {...register('breakfastTime')} />
          </FormField>
          <FormField label="Restaurant timing" htmlFor="restaurantTime" error={errors.restaurantTime?.message}>
            <Input id="restaurantTime" type="time" {...register('restaurantTime')} />
          </FormField>
        </CardBody>
      </Card>

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}

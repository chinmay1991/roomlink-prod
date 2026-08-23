import { useFormContext } from 'react-hook-form'
import { CreateHotelInput } from '@/server/validation/hotel.schema'
import { PlanOption } from './step-plan'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || '—'}</span>
    </div>
  )
}

export function StepReview({ plans }: { plans: PlanOption[] }) {
  const { getValues } = useFormContext<CreateHotelInput>()
  const v = getValues()
  const plan = plans.find((p) => p.plan_id === v.planId)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Hotel</h3>
        <Row label="Name" value={v.name} />
        <Row label="Code" value={v.hotelCode} />
        <Row label="Brand" value={v.brand} />
        <Row label="Hours" value={`${v.checkInTime} check-in · ${v.checkOutTime} check-out`} />
        <Row label="Location" value={[v.addressLine, v.city, v.state, v.country].filter(Boolean).join(', ')} />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Plan</h3>
        <Row label="Subscription" value={plan?.name} />
        <Row label="Trial length" value={`${v.trialDays} days`} />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Hotel Admin</h3>
        <Row label="Name" value={v.adminFullName} />
        <Row label="Email" value={v.adminEmail} />
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
        Creating this hotel will also create the Hotel Admin account, seed the 9-step onboarding tracker, start a
        trial subscription, and email the Hotel Admin their login link and temporary password. You&apos;ll also see
        the temporary password on the next screen in case you need to share it manually.
      </div>
    </div>
  )
}

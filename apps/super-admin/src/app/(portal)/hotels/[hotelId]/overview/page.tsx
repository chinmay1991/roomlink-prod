import { getHotelOverview } from '@/server/services/hotels.service'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { formatDate, formatDateTime, timeAgo } from '@/lib/format'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default async function HotelOverviewPage({ params }: { params: { hotelId: string } }) {
  const { hotel, roomCount, departments, admin, onboardingPercent } = await getHotelOverview(params.hotelId)
  if (!hotel) return null

  const address = [hotel.address_line, hotel.city, hotel.state, hotel.pincode, hotel.country].filter(Boolean).join(', ')

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Property details</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Address" value={address || '—'} />
            <Field label="Contact person" value={hotel.contact_person ?? '—'} />
            <Field label="Phone" value={hotel.phone ?? '—'} />
            <Field label="Reception Contact" value={hotel.reception_contact ?? '—'} />
            <Field label="Room Service Contact" value={hotel.room_service_contact ?? '—'} />
            <Field label="Email" value={hotel.email ?? '—'} />
            <Field label="Time zone" value={hotel.time_zone} />
            <Field
              label="Check-in / check-out"
              value={`${new Date(hotel.check_in_time).toISOString().slice(11, 16)} / ${new Date(hotel.check_out_time).toISOString().slice(11, 16)}`}
            />
            <Field label="Room count" value={roomCount} />
            <Field label="Current plan" value={hotel.subscription_plans?.name ?? '—'} />
            <Field label="Departments" value={departments.length ? departments.map((d) => d.name).join(', ') : '—'} />
            <Field label="Created" value={formatDate(hotel.created_at)} />
          </dl>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Onboarding</h2>
          </CardHeader>
          <CardBody>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{onboardingPercent.toFixed(0)}%</span>
              <span className="text-xs text-slate-500">complete</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${onboardingPercent}%` }} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Hotel Admin</h2>
          </CardHeader>
          <CardBody>
            {admin ? (
              <dl className="space-y-3">
                <Field label="Name" value={admin.full_name} />
                <Field label="Email" value={admin.email} />
                <Field label="Last login" value={admin.last_login_at ? timeAgo(admin.last_login_at) : 'Never signed in'} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No Hotel Admin invited yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

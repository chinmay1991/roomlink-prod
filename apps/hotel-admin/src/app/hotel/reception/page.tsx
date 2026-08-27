import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listReception } from '@/server/services/staff.service'
import { SectionTabs } from '@/components/layout/section-tabs'
import { ReceptionPanel } from './reception-panel'

export default async function ReceptionPage() {
  const session = await requireHotelPageSession()
  const reception = await listReception(session.user.hotelId)

  return (
    <div className="space-y-5">
      <SectionTabs section="people" />
      <h1 className="text-xl font-semibold text-slate-900">Reception</h1>
      <ReceptionPanel reception={reception} />
    </div>
  )
}

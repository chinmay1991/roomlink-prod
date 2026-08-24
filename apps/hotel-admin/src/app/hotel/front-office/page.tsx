import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listFrontOfficeStaff } from '@/server/services/staff.service'
import { SectionTabs } from '@/components/layout/section-tabs'
import { FrontOfficePanel } from './front-office-panel'

export default async function FrontOfficePage() {
  const session = await requireHotelPageSession()
  const frontOfficeStaff = await listFrontOfficeStaff(session.user.hotelId)

  return (
    <div className="space-y-5">
      <SectionTabs section="people" />
      <h1 className="text-xl font-semibold text-slate-900">Front Office</h1>
      <FrontOfficePanel frontOfficeStaff={frontOfficeStaff} />
    </div>
  )
}

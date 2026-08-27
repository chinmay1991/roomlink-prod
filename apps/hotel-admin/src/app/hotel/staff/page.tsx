import Link from 'next/link'
import { cn } from '@roomlink/ui'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { isNativeClient } from '@/server/is-native-client'
import { listStaffPage } from '@/server/services/staff.service'
import { listDepartments } from '@/server/services/departments.service'
import { staffListFiltersSchema } from '@/server/validation/staff.schema'
import { SectionTabs } from '@/components/layout/section-tabs'
import { StaffList } from './staff-list'
import { CreateStaffForm } from './create-staff-form'

export default async function StaffPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await requireHotelPageSession()
  const hotelId = session.user.hotelId
  const filters = staffListFiltersSchema.parse(searchParams)

  const [{ items: staff, page, totalPages }, { departments }] = await Promise.all([
    listStaffPage(hotelId, filters),
    listDepartments(hotelId),
  ])
  const enabledDepartments = departments.filter((d) => d.is_enabled)

  return (
    <div className="space-y-5">
      <SectionTabs section="people" />
      <h1 className="text-xl font-semibold text-slate-900">Staff</h1>

      <nav className="flex gap-1 border-b border-slate-200">
        {(['active', 'disabled'] as const).map((status) => (
          <Link
            key={status}
            href={status === 'active' ? '/hotel/staff' : '/hotel/staff?status=disabled'}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
              filters.status === status
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            )}
          >
            {status}
          </Link>
        ))}
      </nav>

      <StaffList
        staff={staff}
        departments={enabledDepartments}
        isNative={isNativeClient()}
        pagination={{ page, totalPages, status: filters.status }}
      />
      <CreateStaffForm departments={enabledDepartments} />
    </div>
  )
}

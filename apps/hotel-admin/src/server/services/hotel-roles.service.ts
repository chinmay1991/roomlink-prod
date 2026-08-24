import { prisma } from '@/server/db'
import { HotelModule, FRONT_OFFICE_ROLE_NAMES, isFrontOfficeRoleName } from '@/lib/permissions'

/** Front Office is a normal department (see departments.service.ts), but — like every other
 * department — it gets its own Manager/Staff role pair with its own default grants below. */
export const FRONT_OFFICE_DEPARTMENT_NAME = 'Front Office'

export const HOTEL_STAFF_ROLE_NAMES = [
  'Front Office Manager',
  'Front Office Staff',
  'Department Manager',
  'Department Staff',
] as const
export type HotelStaffRoleName = (typeof HOTEL_STAFF_ROLE_NAMES)[number]

export { FRONT_OFFICE_ROLE_NAMES, isFrontOfficeRoleName }

type Grant = { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }

/**
 * V1 role model is fixed by the PRD (each role has fixed capabilities,
 * §13/§18/§19 of the PRD) — not a flexible permission matrix a GM edits per
 * user. So these are seeded once per role, at role-creation time, rather
 * than exposed as an editable grid. Department-Manager-to-own-department and
 * Staff-to-assigned-task scoping happen in the service layer
 * (departments.manager_id / user_departments), not here — this only gates
 * which *screens* a role can reach at all.
 *
 * Front Office Manager/Staff share the same hotel-wide guest-service
 * monitoring grants (the department's whole point per the architecture
 * change — broader visibility than an operational department, but never
 * automatic access to other departments' management actions); Manager adds
 * the ability to manage Front Office's own staff roster, mirroring how
 * Department Manager gets more than Department Staff.
 */
const FRONT_OFFICE_BASE_GRANTS: Partial<Record<HotelModule, Grant>> = {
  hotel_dashboard: { view: true },
  hotel_departments: { view: true },
  hotel_rooms: { view: true },
  hotel_staff: { view: true },
  hotel_requests: { view: true, create: true, edit: true },
  hotel_guest_sessions: { view: true, create: true, edit: true },
  hotel_notifications: { view: true },
  hotel_conversations: { view: true, edit: true },
  hotel_orders: { view: true },
}

const DEFAULT_GRANTS: Record<HotelStaffRoleName, Partial<Record<HotelModule, Grant>>> = {
  'Front Office Staff': FRONT_OFFICE_BASE_GRANTS,
  'Front Office Manager': {
    ...FRONT_OFFICE_BASE_GRANTS,
    hotel_staff: { view: true, create: true, edit: true },
  },
  'Department Manager': {
    hotel_dashboard: { view: true },
    hotel_staff: { view: true },
    hotel_services: { view: true, edit: true },
    hotel_requests: { view: true, edit: true },
    hotel_notifications: { view: true },
  },
  'Department Staff': {
    hotel_dashboard: { view: true },
    hotel_requests: { view: true, edit: true },
    hotel_notifications: { view: true },
  },
}

/**
 * Idempotent: returns the hotel-scoped role, creating it on first use. Grant
 * sync runs every call, not just on creation — a hotel whose "Front Office"
 * role was created before `hotel_conversations`/`hotel_orders` existed would
 * otherwise be stuck without those grants forever, since nothing else ever
 * revisits an existing role's permissions. `upsert` per module keeps this
 * cheap and safe to call unconditionally.
 */
export async function getOrCreateHotelRole(hotelId: string, roleName: HotelStaffRoleName) {
  const existing = await prisma.roles.findUnique({ where: { hotel_id_name: { hotel_id: hotelId, name: roleName } } })
  const role = existing ?? (await prisma.roles.create({ data: { hotel_id: hotelId, name: roleName, is_system_role: false } }))

  const grants = DEFAULT_GRANTS[roleName]
  for (const [module, grant] of Object.entries(grants) as [HotelModule, Grant][]) {
    const permission = await prisma.permissions.upsert({
      where: { module },
      update: {},
      create: { module },
    })
    await prisma.role_permissions.upsert({
      where: { role_id_permission_id: { role_id: role.role_id, permission_id: permission.permission_id } },
      update: {},
      create: {
        role_id: role.role_id,
        permission_id: permission.permission_id,
        can_view: grant.view ?? false,
        can_create: grant.create ?? false,
        can_edit: grant.edit ?? false,
        can_delete: grant.delete ?? false,
      },
    })
  }

  return role
}

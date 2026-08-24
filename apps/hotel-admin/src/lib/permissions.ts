/** The only user_type values this app's login accepts. */
export const HOTEL_PORTAL_USER_TYPES = ['hotel_admin', 'hotel_staff'] as const
export type HotelPortalUserType = (typeof HOTEL_PORTAL_USER_TYPES)[number]

/**
 * Nav sections / permissions.module values for hotel-scoped role_permissions
 * rows (Front Office Manager/Staff, Department Manager, Department Staff).
 * hotel_admin bypasses this entirely — see server/hotel-rbac.ts.
 */
export const HOTEL_MODULES = [
  'hotel_dashboard',
  'hotel_profile',
  'hotel_departments',
  'hotel_rooms',
  'hotel_qr_codes',
  'hotel_staff',
  'hotel_managers',
  'hotel_services',
  'hotel_menu',
  'hotel_requests',
  'hotel_guest_sessions',
  'hotel_notifications',
  'hotel_settings',
  'hotel_conversations',
  'hotel_orders',
] as const

export type HotelModule = (typeof HOTEL_MODULES)[number]

/**
 * Front Office is a normal department (departments.service.ts), but — like
 * every other department — it has its own Manager/Staff role pair, seeded
 * with its own default grants (hotel-roles.service.ts). Any code that needs
 * to ask "is this session a Front Office session" (routing, nav, RBAC
 * special cases) should check membership in this list, not a single literal
 * role name, so Manager and Staff are always handled identically wherever
 * that distinction doesn't matter.
 */
export const FRONT_OFFICE_ROLE_NAMES = ['Front Office Manager', 'Front Office Staff'] as const
export type FrontOfficeRoleName = (typeof FRONT_OFFICE_ROLE_NAMES)[number]

export function isFrontOfficeRoleName(roleName: string | null | undefined): boolean {
  return (FRONT_OFFICE_ROLE_NAMES as readonly string[]).includes(roleName ?? '')
}

/**
 * Single source of truth for "where does a signed-in session land" —
 * Department Manager's landing page is the department-scoped Queue (PRD §3),
 * Department Staff's is the mobile-first task Home (Staff PRD §5), neither
 * the hotel-wide dashboard everyone else gets. Used by both the root page
 * and the login page so the two can't drift out of sync again.
 */
export function postLoginPath(roleName: string | null): string {
  if (roleName === 'Department Manager') return '/hotel/manager/queue'
  if (roleName === 'Department Staff') return '/hotel/staff/home'
  if (isFrontOfficeRoleName(roleName)) return '/hotel/front-office-desk/dashboard'
  return '/hotel/dashboard'
}

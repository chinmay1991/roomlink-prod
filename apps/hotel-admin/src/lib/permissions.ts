/** The only user_type values this app's login accepts. */
export const HOTEL_PORTAL_USER_TYPES = ['hotel_admin', 'hotel_staff'] as const
export type HotelPortalUserType = (typeof HOTEL_PORTAL_USER_TYPES)[number]

/**
 * Nav sections / permissions.module values for hotel-scoped role_permissions
 * rows (Reception, Department Manager, Department Staff). hotel_admin
 * bypasses this entirely — see server/hotel-rbac.ts.
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
 * Single source of truth for "where does a signed-in session land" —
 * Department Manager's landing page is the department-scoped Queue (PRD §3),
 * Department Staff's is the mobile-first task Home (Staff PRD §5), neither
 * the hotel-wide dashboard everyone else gets. Used by both the root page
 * and the login page so the two can't drift out of sync again.
 */
export function postLoginPath(roleName: string | null): string {
  if (roleName === 'Department Manager') return '/hotel/manager/queue'
  if (roleName === 'Department Staff') return '/hotel/staff/home'
  if (roleName === 'Reception') return '/hotel/reception-desk/dashboard'
  return '/hotel/dashboard'
}

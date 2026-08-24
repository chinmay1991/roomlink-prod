import { prisma } from '@/server/db'
import { HotelModule } from '@/lib/permissions'
import type { HotelSessionUser } from '@/server/require-hotel-session'

export type HotelAction = 'view' | 'create' | 'edit' | 'delete'

/**
 * hotel_admin can do everything within their own hotel — hotel_id scoping is
 * enforced by the caller on every query, not here. hotel_staff (Front Office,
 * Department Manager, Department Staff) are scoped by their hotel-scoped
 * roles/role_permissions row (same tables the Super Admin portal uses for
 * support_staff — this app just has its own HOTEL_MODULES list).
 *
 * Department-Manager-to-own-department scoping is data-scoping, not a
 * view/create/edit/delete flag, so it's enforced in the relevant service
 * functions via departments.manager_id, not here.
 */
export async function canHotel(user: HotelSessionUser, module: HotelModule, action: HotelAction): Promise<boolean> {
  if (user.userType === 'hotel_admin') return true

  const permission = await prisma.permissions.findUnique({ where: { module } })
  if (!permission) return false

  const grant = await prisma.role_permissions.findUnique({
    where: { role_id_permission_id: { role_id: user.roleId, permission_id: permission.permission_id } },
  })
  if (!grant) return false

  switch (action) {
    case 'view':
      return grant.can_view
    case 'create':
      return grant.can_create
    case 'edit':
      return grant.can_edit
    case 'delete':
      return grant.can_delete
  }
}

export async function requireCanHotel(user: HotelSessionUser, module: HotelModule, action: HotelAction) {
  const allowed = await canHotel(user, module, action)
  if (!allowed) {
    throw new ForbiddenError(`${user.userType} lacks ${action} on ${module}`)
  }
}

export class ForbiddenError extends Error {}

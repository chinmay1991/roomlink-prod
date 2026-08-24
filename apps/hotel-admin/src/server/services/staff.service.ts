import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { generateTempPassword } from '@/lib/temp-password'
import { getOrCreateHotelRole, FRONT_OFFICE_DEPARTMENT_NAME, FRONT_OFFICE_ROLE_NAMES } from '@/server/services/hotel-roles.service'
import { markStepComplete } from '@/server/services/hotel-onboarding.service'
import { ForbiddenError } from '@/server/hotel-rbac'
import type { CreateStaffInput, UpdateStaffInput, CreateFrontOfficeStaffInput } from '@/server/validation/staff.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

const STAFF_INCLUDE = {
  roles: { select: { name: true } },
  user_departments: { include: { departments: { select: { department_id: true, name: true } } } },
  departments_managed: { select: { department_id: true, name: true } },
} as const

/** Every non-Front-Office hotel_staff user — Department Staff and Department Manager share this list (§7 of the PRD: one staff account, many departments). */
export async function listStaff(hotelId: string) {
  return prisma.users.findMany({
    where: { hotel_id: hotelId, user_type: 'hotel_staff', roles: { name: { in: ['Department Staff', 'Department Manager'] } } },
    orderBy: { full_name: 'asc' },
    include: STAFF_INCLUDE,
  })
}

/**
 * Staff PRD §18 — a staff member's own read-only profile. Deliberately a
 * narrower select than `STAFF_INCLUDE`/`listStaff`: no `role_id`/managed
 * departments, since role and department *permissions* are Hotel Admin-only
 * fields (PRD §18: "Staff should NOT be able to modify role, hotel,
 * department permissions") — this endpoint only ever returns what's
 * displayed, not what could be edited.
 */
export async function getOwnStaffProfile(hotelId: string, userId: string) {
  return prisma.users.findFirstOrThrow({
    where: { user_id: userId, hotel_id: hotelId },
    select: {
      full_name: true,
      employee_id: true,
      email: true,
      phone: true,
      status: true,
      user_departments: { include: { departments: { select: { department_id: true, name: true } } } },
    },
  })
}

export async function listFrontOfficeStaff(hotelId: string) {
  return prisma.users.findMany({
    where: { hotel_id: hotelId, user_type: 'hotel_staff', roles: { name: { in: [...FRONT_OFFICE_ROLE_NAMES] } } },
    orderBy: { full_name: 'asc' },
    include: STAFF_INCLUDE,
  })
}

export async function createStaff(hotelId: string, input: CreateStaffInput, actor: HotelSessionUser) {
  const role = await getOrCreateHotelRole(hotelId, 'Department Staff')
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  // departmentIds are client-supplied — prove they belong to this hotel before use.
  const requestedDepartmentIds = input.departmentIds ?? []
  if (requestedDepartmentIds.length > 0) {
    const owned = await prisma.departments.count({
      where: { hotel_id: hotelId, department_id: { in: requestedDepartmentIds } },
    })
    if (owned !== requestedDepartmentIds.length) throw new ForbiddenError('One or more departments do not belong to this hotel')
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        hotel_id: hotelId,
        role_id: role.role_id,
        user_type: 'hotel_staff',
        full_name: input.fullName,
        employee_id: input.employeeId || null,
        email: input.email,
        phone: input.mobile || null,
        password_hash: passwordHash,
        status: 'active',
      },
    })

    const departmentIds = input.departmentIds ?? []
    if (departmentIds.length > 0) {
      await tx.user_departments.createMany({
        data: departmentIds.map((department_id) => ({ user_id: created.user_id, department_id })),
      })
    }

    await recordAudit(
      {
        actorId: actor.id,
        actorType: actor.userType,
        action: 'staff.created',
        entityType: 'user',
        entityId: created.user_id,
        afterState: { full_name: created.full_name, department_ids: departmentIds },
      },
      tx
    )

    return created
  })

  await markStepComplete(hotelId, 'Staff')

  return { user, tempPassword }
}

/**
 * Front Office is a mandatory department every hotel already has (see
 * hotels.service.ts/the Front Office migration) — staff created here are
 * always linked to it via user_departments, unlike the old Reception flow
 * which had no department membership at all. This is what lets Front Office
 * staff show up in department-scoped screens (Team, monitoring) the same
 * way every other department's staff already do.
 */
export async function createFrontOfficeStaff(hotelId: string, input: CreateFrontOfficeStaffInput, actor: HotelSessionUser) {
  const [role, frontOffice] = await Promise.all([
    getOrCreateHotelRole(hotelId, 'Front Office Staff'),
    prisma.departments.findFirstOrThrow({ where: { hotel_id: hotelId, name: FRONT_OFFICE_DEPARTMENT_NAME } }),
  ])
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        hotel_id: hotelId,
        role_id: role.role_id,
        user_type: 'hotel_staff',
        full_name: input.fullName,
        employee_id: input.employeeId || null,
        email: input.email,
        phone: input.mobile || null,
        password_hash: passwordHash,
        status: 'active',
      },
    })

    await tx.user_departments.create({
      data: { user_id: created.user_id, department_id: frontOffice.department_id, is_primary: true },
    })

    await recordAudit(
      {
        actorId: actor.id,
        actorType: actor.userType,
        action: 'front_office_staff.created',
        entityType: 'user',
        entityId: created.user_id,
        afterState: { full_name: created.full_name },
      },
      tx
    )

    return created
  })

  return { user, tempPassword }
}

export async function updateStaff(hotelId: string, userId: string, input: UpdateStaffInput, actor: HotelSessionUser) {
  const before = await prisma.users.findFirstOrThrow({ where: { user_id: userId, hotel_id: hotelId } })

  const after = await prisma.users.update({
    where: { user_id: userId },
    data: {
      full_name: input.fullName,
      employee_id: input.employeeId || null,
      email: input.email,
      phone: input.mobile || null,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'staff.updated',
    entityType: 'user',
    entityId: userId,
    beforeState: { full_name: before.full_name, email: before.email },
    afterState: { full_name: after.full_name, email: after.email },
  })

  return after
}

export async function toggleStaffStatus(hotelId: string, userId: string, actor: HotelSessionUser) {
  const before = await prisma.users.findFirstOrThrow({ where: { user_id: userId, hotel_id: hotelId } })
  const nextStatus = before.status === 'active' ? 'disabled' : 'active'

  const after = await prisma.users.update({ where: { user_id: userId }, data: { status: nextStatus } })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: nextStatus === 'active' ? 'staff.activated' : 'staff.deactivated',
    entityType: 'user',
    entityId: userId,
    beforeState: { status: before.status },
    afterState: { status: after.status },
  })

  return after
}

export async function resetStaffAccess(hotelId: string, userId: string, actor: HotelSessionUser) {
  await prisma.users.findFirstOrThrow({ where: { user_id: userId, hotel_id: hotelId } })

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)
  await prisma.users.update({ where: { user_id: userId }, data: { password_hash: passwordHash } })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'staff.access_reset',
    entityType: 'user',
    entityId: userId,
  })

  return tempPassword
}

/** Replaces the full department-membership set for a staff member — many-to-many, per §7 of the PRD. */
export async function setStaffDepartments(hotelId: string, userId: string, departmentIds: string[], actor: HotelSessionUser) {
  await prisma.users.findFirstOrThrow({ where: { user_id: userId, hotel_id: hotelId } })

  if (departmentIds.length > 0) {
    const owned = await prisma.departments.count({ where: { hotel_id: hotelId, department_id: { in: departmentIds } } })
    if (owned !== departmentIds.length) throw new ForbiddenError('One or more departments do not belong to this hotel')
  }

  await prisma.$transaction(async (tx) => {
    await tx.user_departments.deleteMany({ where: { user_id: userId } })
    if (departmentIds.length > 0) {
      await tx.user_departments.createMany({
        data: departmentIds.map((department_id) => ({ user_id: userId, department_id })),
      })
    }
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'staff.departments_updated',
    entityType: 'user',
    entityId: userId,
    afterState: { department_ids: departmentIds },
  })

  return prisma.users.findUniqueOrThrow({ where: { user_id: userId }, include: STAFF_INCLUDE })
}

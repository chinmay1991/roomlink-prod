import bcrypt from 'bcryptjs'
import { Prisma, hotel_status } from '@prisma/client'
import { prisma } from '@/server/db'
import { PAGE_SIZE, HotelListFilters, CreateHotelInput } from '@/server/validation/hotel.schema'
import { generateTempPassword } from '@/lib/temp-password'
import { recordAudit } from '@/server/audit'
import { getNotificationProvider } from '@/server/notifications'

/**
 * Matches the Hotel Admin / GM onboarding wizard order (PRD §8). "Go Live" is
 * not tracked here — it's the terminal action in apps/hotel-admin that flips
 * hotels.status, not a checklist row (see hotel-onboarding.service.ts there).
 */
const ONBOARDING_STEPS = [
  'Hotel Profile',
  'Legal & GST',
  'Departments',
  'Rooms',
  'QR Codes',
  'Staff',
  'Department Managers',
  'Guest Services',
  'Restaurant Menu',
  'Notifications & Settings',
  'Review',
]

function timeToDate(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00Z`)
}

export type CreatedHotel = {
  hotelId: string
  adminEmail: string
  adminTempPassword: string
}

/**
 * Epic 2: the Hotel Creation Wizard's submit action. One transaction —
 * hotel + Hotel Admin role + Hotel Admin user + onboarding tracker +
 * trial subscription + audit entry — so a failure never leaves an
 * orphaned hotel with no admin.
 */
export async function createHotel(input: CreateHotelInput, actorId: string): Promise<CreatedHotel> {
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const result = await prisma.$transaction(async (tx) => {
    const hotel = await tx.hotels.create({
      data: {
        name: input.name,
        hotel_code: input.hotelCode,
        brand: input.brand || null,
        address_line: input.addressLine || null,
        city: input.city || null,
        state: input.state || null,
        country: input.country || null,
        pincode: input.pincode || null,
        contact_person: input.contactPerson || null,
        phone: input.phone || null,
        email: input.email || null,
        time_zone: input.timeZone,
        check_in_time: timeToDate(input.checkInTime),
        check_out_time: timeToDate(input.checkOutTime),
        status: 'onboarding',
        plan_id: input.planId,
      },
    })

    const role = await tx.roles.create({
      data: { hotel_id: hotel.hotel_id, name: 'Hotel Admin', is_system_role: false },
    })

    // Front Office is a normal department, but a mandatory one — every hotel gets it
    // at creation time, the same way every hotel gets a Hotel Admin role.
    await tx.departments.create({
      data: { hotel_id: hotel.hotel_id, name: 'Front Office', is_custom: false, is_enabled: true, is_mandatory: true },
    })

    const admin = await tx.users.create({
      data: {
        hotel_id: hotel.hotel_id,
        role_id: role.role_id,
        user_type: 'hotel_admin',
        full_name: input.adminFullName,
        email: input.adminEmail,
        phone: input.adminPhone || null,
        password_hash: passwordHash,
        // 'invited' would block login in apps/hotel-admin (authorize() requires
        // status === 'active') and V1 has no accept-invite flow to clear it —
        // the temp password below *is* the activation step.
        status: 'active',
      },
    })

    await tx.onboarding_tracker.createMany({
      data: ONBOARDING_STEPS.map((step, i) => ({
        hotel_id: hotel.hotel_id,
        step_name: step,
        step_order: i + 1,
        status: i === 0 ? 'complete' : 'pending',
      })),
    })

    const startDate = new Date()
    const trialEnd = new Date(startDate.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
    await tx.subscriptions.create({
      data: {
        hotel_id: hotel.hotel_id,
        plan_id: input.planId,
        status: 'trial',
        start_date: startDate,
        trial_end_date: trialEnd,
        auto_renew: true,
      },
    })

    await recordAudit(
      {
        actorId,
        actorType: 'super_admin',
        action: 'hotel.created',
        entityType: 'hotel',
        entityId: hotel.hotel_id,
        afterState: { name: hotel.name, hotel_code: hotel.hotel_code, plan_id: input.planId },
      },
      tx
    )

    return { hotelId: hotel.hotel_id, adminEmail: admin.email }
  })

  const loginUrl = `${(process.env.HOTEL_ADMIN_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/login`
  await getNotificationProvider()
    .sendEmail(
      result.adminEmail,
      "You're invited to RoomLink",
      `You've been made Hotel Admin for ${input.name}.\n\nSign in at ${loginUrl} with:\nEmail: ${result.adminEmail}\nTemporary password: ${tempPassword}`
    )
    .catch((err) => console.error('Failed to send invite email:', err))

  return { ...result, adminTempPassword: tempPassword }
}

export async function listHotels(filters: HotelListFilters) {
  const where: Prisma.hotelsWhereInput = {
    ...(filters.status ? { status: filters.status as hotel_status } : {}),
    ...(filters.planId ? { plan_id: filters.planId } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' } },
            { city: { contains: filters.q, mode: 'insensitive' } },
            { hotel_code: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total, plans] = await Promise.all([
    prisma.hotels.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscription_plans: { select: { name: true } },
        _count: { select: { rooms: true } },
      },
    }),
    prisma.hotels.count({ where }),
    prisma.subscription_plans.findMany({ orderBy: { name: 'asc' }, select: { plan_id: true, name: true } }),
  ])

  return {
    items,
    total,
    page: filters.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    plans,
  }
}

export async function getHotelHeader(hotelId: string) {
  return prisma.hotels.findUnique({
    where: { hotel_id: hotelId },
    include: { subscription_plans: { select: { name: true } } },
  })
}

export async function getHotelOverview(hotelId: string) {
  const [hotel, roomCount, departments, admin, onboarding] = await Promise.all([
    prisma.hotels.findUnique({
      where: { hotel_id: hotelId },
      include: { subscription_plans: true },
    }),
    prisma.rooms.count({ where: { hotel_id: hotelId } }),
    prisma.departments.findMany({ where: { hotel_id: hotelId }, orderBy: { name: 'asc' } }),
    prisma.users.findFirst({
      where: { hotel_id: hotelId, user_type: 'hotel_admin' },
      orderBy: { created_at: 'asc' },
    }),
    prisma.$queryRaw<{ percent_complete: Prisma.Decimal | null }[]>`
      SELECT percent_complete FROM v_hotel_onboarding_progress WHERE hotel_id = ${hotelId}::uuid
    `,
  ])

  return {
    hotel,
    roomCount,
    departments,
    admin,
    onboardingPercent: onboarding[0]?.percent_complete ? Number(onboarding[0].percent_complete) : 0,
  }
}

export async function getHotelSubscription(hotelId: string) {
  return prisma.subscriptions.findFirst({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'desc' },
    include: { subscription_plans: true },
  })
}

export async function getHotelUsers(hotelId: string) {
  return prisma.users.findMany({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'asc' },
    include: { roles: { select: { name: true } } },
  })
}

export async function getHotelRooms(hotelId: string) {
  const [byStatus, byType, total] = await Promise.all([
    prisma.rooms.groupBy({ by: ['status'], where: { hotel_id: hotelId }, _count: true }),
    prisma.rooms.findMany({
      where: { hotel_id: hotelId },
      select: { room_types: { select: { name: true } } },
    }),
    prisma.rooms.count({ where: { hotel_id: hotelId } }),
  ])

  const typeCounts = new Map<string, number>()
  for (const room of byType) {
    const name = room.room_types?.name ?? 'Unassigned'
    typeCounts.set(name, (typeCounts.get(name) ?? 0) + 1)
  }

  return {
    total,
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
    byType: Array.from(typeCounts.entries()).map(([name, count]) => ({ name, count })),
  }
}

export async function getHotelOnboarding(hotelId: string) {
  return prisma.onboarding_tracker.findMany({
    where: { hotel_id: hotelId },
    orderBy: { step_order: 'asc' },
  })
}

export async function getHotelActivity(hotelId: string) {
  return prisma.audit_logs.findMany({
    where: { entity_type: 'hotel', entity_id: hotelId },
    orderBy: { created_at: 'desc' },
    take: 50,
  })
}

export async function getHotelSupportTickets(hotelId: string) {
  return prisma.support_tickets.findMany({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'desc' },
  })
}

export async function getHotelInvoices(hotelId: string) {
  return prisma.invoices.findMany({
    where: { hotel_id: hotelId },
    orderBy: { created_at: 'desc' },
  })
}

/**
 * Broader than the Activity tab: everything traceable to this hotel across
 * entity types (the hotel itself, its subscriptions, and its users) — since
 * audit_logs has no hotel_id column of its own.
 */
export async function getHotelAuditTrail(hotelId: string) {
  const [subs, users] = await Promise.all([
    prisma.subscriptions.findMany({ where: { hotel_id: hotelId }, select: { subscription_id: true } }),
    prisma.users.findMany({ where: { hotel_id: hotelId }, select: { user_id: true } }),
  ])

  const entityIds = [hotelId, ...subs.map((s) => s.subscription_id), ...users.map((u) => u.user_id)]

  return prisma.audit_logs.findMany({
    where: { entity_id: { in: entityIds } },
    orderBy: { created_at: 'desc' },
    take: 100,
  })
}

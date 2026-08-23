import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { generateTempPassword } from '@/lib/temp-password'
import { getNotificationProvider } from '@/server/notifications'
import type { SessionUser } from '@/server/rbac'

export async function listHotelAdmins(filters: { q?: string; status?: string }) {
  return prisma.users.findMany({
    where: {
      user_type: 'hotel_admin',
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.q
        ? {
            OR: [
              { full_name: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { hotels_users_hotel_idTohotels: { select: { hotel_id: true, name: true } } },
  })
}

export async function updateHotelAdmin(
  userId: string,
  data: { fullName: string; email: string; phone?: string },
  actor: SessionUser
) {
  const before = await prisma.users.findUniqueOrThrow({ where: { user_id: userId } })

  const after = await prisma.users.update({
    where: { user_id: userId },
    data: { full_name: data.fullName, email: data.email, phone: data.phone || null },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType === 'super_admin' ? 'super_admin' : 'hotel_staff',
    action: 'user.updated',
    entityType: 'user',
    entityId: userId,
    beforeState: { full_name: before.full_name, email: before.email, phone: before.phone },
    afterState: { full_name: after.full_name, email: after.email, phone: after.phone },
  })

  return after
}

export async function resetHotelAdminPassword(userId: string, actor: SessionUser) {
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const user = await prisma.users.update({ where: { user_id: userId }, data: { password_hash: passwordHash } })

  await recordAudit({
    actorId: actor.id,
    actorType: 'super_admin',
    action: 'user.password_reset',
    entityType: 'user',
    entityId: userId,
  })

  const loginUrl = `${(process.env.HOTEL_ADMIN_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/login`
  await getNotificationProvider()
    .sendEmail(
      user.email,
      'Your RoomLink password was reset',
      `Your new temporary password is: ${tempPassword}\n\nSign in at ${loginUrl}`
    )
    .catch((err) => console.error('Failed to send password-reset email:', err))

  return tempPassword
}

export async function resendHotelAdminInvite(userId: string, actor: SessionUser) {
  const tempPassword = await resetHotelAdminPassword(userId, actor)
  // 'active', not 'invited' — apps/hotel-admin's authorize() rejects any
  // non-active status and V1 has no accept-invite flow to clear it. The
  // temp password just emailed is the activation step. Skip the flip for a
  // 'disabled' admin so this can't be used to bypass an explicit Disable.
  await prisma.users.updateMany({
    where: { user_id: userId, status: { not: 'disabled' } },
    data: { status: 'active' },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: 'super_admin',
    action: 'user.invite_resent',
    entityType: 'user',
    entityId: userId,
  })

  return tempPassword
}

export async function toggleHotelAdminStatus(userId: string, actor: SessionUser) {
  const user = await prisma.users.findUniqueOrThrow({ where: { user_id: userId } })
  const nextStatus = user.status === 'disabled' ? 'active' : 'disabled'

  const updated = await prisma.users.update({ where: { user_id: userId }, data: { status: nextStatus } })

  await recordAudit({
    actorId: actor.id,
    actorType: 'super_admin',
    action: nextStatus === 'disabled' ? 'user.disabled' : 'user.enabled',
    entityType: 'user',
    entityId: userId,
    beforeState: { status: user.status },
    afterState: { status: nextStatus },
  })

  return updated
}

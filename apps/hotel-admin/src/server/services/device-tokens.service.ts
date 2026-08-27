import { prisma } from '@/server/db'
import type { RegisterDeviceTokenInput } from '@/server/validation/device-token.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

/**
 * `token` is the unique key (see schema.prisma) — a physical device's token
 * identifies that install, so registering it again just reassigns it to
 * whoever is currently signed in, which is exactly correct if a different
 * user later signs into the same device.
 */
export async function registerDeviceToken(hotelId: string, input: RegisterDeviceTokenInput, actor: HotelSessionUser) {
  await prisma.device_tokens.upsert({
    where: { token: input.token },
    create: { hotel_id: hotelId, user_id: actor.id, platform: input.platform, token: input.token },
    update: { hotel_id: hotelId, user_id: actor.id, platform: input.platform, updated_at: new Date() },
  })
}

/** Scoped to the caller's own token so one user can never unregister another's. */
export async function unregisterDeviceToken(userId: string, token: string) {
  await prisma.device_tokens.deleteMany({ where: { token, user_id: userId } })
}

/**
 * The targeting unit escalateRequest's push needs: `recipient` mirrors
 * EscalateRequestInput's own 'gm' | 'reception' choice exactly. 'gm' is
 * userType-based (like hotel-rbac.ts's canHotel), not roleName-based —
 * hotel_admin users bypass the roles/role_permissions system entirely, so
 * their roles.name isn't a reliable "is this the GM" check the way
 * roleName === 'Reception' is for that role.
 */
export async function getDeviceTokensForRecipient(
  hotelId: string,
  recipient: 'gm' | 'reception'
): Promise<{ token: string; platform: string }[]> {
  return prisma.device_tokens.findMany({
    where: {
      hotel_id: hotelId,
      users: recipient === 'gm' ? { user_type: 'hotel_admin' } : { roles: { name: 'Reception' } },
    },
    select: { token: true, platform: true },
  })
}

import { unstable_cache, revalidateTag } from 'next/cache'
import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { markStepComplete } from '@/server/services/hotel-onboarding.service'
import type { UpdateHotelProfileInput, UpdateHotelLegalInput } from '@/server/validation/hotel-profile.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

const profileTag = (hotelId: string) => `hotel-profile-${hotelId}`

function timeToDate(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00Z`)
}

export function dateToTimeString(date: Date | string | null | undefined): string {
  if (!date) return ''
  // getHotelProfile is wrapped in unstable_cache, which round-trips its
  // return value through JSON — Prisma's Date fields come back as plain
  // ISO strings on a cache hit (though still real Dates on a cache miss),
  // so this has to handle both.
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().slice(11, 16)
}

/**
 * Backs both the Profile and Legal pages — same `hotels` row, so one cache
 * entry (busted by either update function below) covers both. Business
 * info/GSTIN/PAN/billing address change rarely; see getHotelSettings for
 * why unstable_cache (not route-level revalidate) is what's needed here.
 */
export async function getHotelProfile(hotelId: string) {
  return unstable_cache(
    async (id: string) => prisma.hotels.findUniqueOrThrow({ where: { hotel_id: id } }),
    ['hotel-profile'],
    { revalidate: 60, tags: [profileTag(hotelId)] }
  )(hotelId)
}

export async function updateHotelProfile(hotelId: string, input: UpdateHotelProfileInput, actor: HotelSessionUser) {
  const before = await prisma.hotels.findUniqueOrThrow({ where: { hotel_id: hotelId } })

  const after = await prisma.hotels.update({
    where: { hotel_id: hotelId },
    data: {
      name: input.name,
      brand: input.brand || null,
      description: input.description || null,
      address_line: input.addressLine || null,
      city: input.city || null,
      state: input.state || null,
      pincode: input.pincode || null,
      country: input.country,
      phone: input.phone || null,
      reception_contact: input.receptionContact,
      room_service_contact: input.roomServiceContact,
      email: input.email || null,
      website: input.website || null,
      time_zone: input.timeZone,
      check_in_time: timeToDate(input.checkInTime),
      check_out_time: timeToDate(input.checkOutTime),
      breakfast_time: input.breakfastTime ? timeToDate(input.breakfastTime) : null,
      restaurant_time: input.restaurantTime ? timeToDate(input.restaurantTime) : null,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'hotel.profile_updated',
    entityType: 'hotel',
    entityId: hotelId,
    beforeState: { name: before.name, city: before.city, time_zone: before.time_zone },
    afterState: { name: after.name, city: after.city, time_zone: after.time_zone },
  })

  await markStepComplete(hotelId, 'Hotel Profile')
  revalidateTag(profileTag(hotelId))

  return after
}

export async function updateHotelLegal(hotelId: string, input: UpdateHotelLegalInput, actor: HotelSessionUser) {
  const before = await prisma.hotels.findUniqueOrThrow({ where: { hotel_id: hotelId } })

  const after = await prisma.hotels.update({
    where: { hotel_id: hotelId },
    data: {
      legal_business_name: input.legalBusinessName || null,
      gstin: input.gstin || null,
      pan: input.pan || null,
      billing_address_line: input.billingAddressLine || null,
      billing_city: input.billingCity || null,
      billing_state: input.billingState || null,
      billing_pincode: input.billingPincode || null,
      billing_country: input.billingCountry || null,
      billing_email: input.billingEmail || null,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'hotel.legal_updated',
    entityType: 'hotel',
    entityId: hotelId,
    beforeState: { gstin: before.gstin, legal_business_name: before.legal_business_name },
    afterState: { gstin: after.gstin, legal_business_name: after.legal_business_name },
  })

  await markStepComplete(hotelId, 'Legal & GST')
  revalidateTag(profileTag(hotelId))

  return after
}

import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { getHotelProfile, dateToTimeString } from '@/server/services/hotel-profile.service'
import { SectionTabs } from '@/components/layout/section-tabs'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const session = await requireHotelPageSession()
  const hotel = await getHotelProfile(session.user.hotelId)

  return (
    <div className="space-y-5">
      <SectionTabs section="hotel" />
      <h1 className="text-xl font-semibold text-slate-900">Hotel Profile</h1>
      <ProfileForm
        initial={{
          name: hotel.name,
          brand: hotel.brand ?? '',
          description: hotel.description ?? '',
          addressLine: hotel.address_line ?? '',
          city: hotel.city ?? '',
          state: hotel.state ?? '',
          pincode: hotel.pincode ?? '',
          country: hotel.country ?? 'India',
          phone: hotel.phone ?? '',
          receptionContact: hotel.reception_contact ?? '',
          roomServiceContact: hotel.room_service_contact ?? '',
          email: hotel.email ?? '',
          website: hotel.website ?? '',
          timeZone: hotel.time_zone,
          checkInTime: dateToTimeString(hotel.check_in_time),
          checkOutTime: dateToTimeString(hotel.check_out_time),
          breakfastTime: dateToTimeString(hotel.breakfast_time),
          restaurantTime: dateToTimeString(hotel.restaurant_time),
        }}
      />
    </div>
  )
}

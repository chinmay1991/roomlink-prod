import { z } from 'zod'
import { uuid } from './common'

export const hotelListFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['pending', 'onboarding', 'trial', 'active', 'suspended', 'churned']).optional(),
  planId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export type HotelListFilters = z.infer<typeof hotelListFiltersSchema>

export const PAGE_SIZE = 10

const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM (24h)')

export const createHotelSchema = z.object({
  // Step 1: Basic Information
  name: z.string().trim().min(2, 'Hotel name is required').max(200),
  hotelCode: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers, and hyphens only'),
  brand: z.string().trim().max(100).optional().or(z.literal('')),
  timeZone: z.string().trim().min(1),
  checkInTime: timeString,
  checkOutTime: timeString,

  // Step 2: Contact Details
  addressLine: z.string().trim().max(255).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100),
  pincode: z.string().trim().max(20).optional().or(z.literal('')),
  contactPerson: z.string().trim().max(150).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  receptionContact: z.string().trim().min(1, 'Reception contact number is required').max(20),
  roomServiceContact: z.string().trim().min(1, 'Room service contact number is required').max(20),
  email: z.string().trim().email().optional().or(z.literal('')),

  // Step 3: Subscription Plan
  planId: uuid,
  trialDays: z.number().int().min(0).max(90),

  // Step 4: Create Hotel Admin
  adminFullName: z.string().trim().min(2, "Hotel Admin's name is required").max(150),
  adminEmail: z.string().trim().email('Enter a valid email'),
  adminPhone: z.string().trim().max(20).optional().or(z.literal('')),
})

export type CreateHotelInput = z.infer<typeof createHotelSchema>

export const createHotelStepFields: Record<1 | 2 | 3 | 4, (keyof CreateHotelInput)[]> = {
  1: ['name', 'hotelCode', 'brand', 'timeZone', 'checkInTime', 'checkOutTime'],
  2: [
    'addressLine',
    'city',
    'state',
    'country',
    'pincode',
    'contactPerson',
    'phone',
    'receptionContact',
    'roomServiceContact',
    'email',
  ],
  3: ['planId', 'trialDays'],
  4: ['adminFullName', 'adminEmail', 'adminPhone'],
}

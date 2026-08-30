import { z } from 'zod'

const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM (24h)')
const optionalStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const updateHotelProfileSchema = z.object({
  name: z.string().trim().min(2, 'Hotel name is required').max(200),
  brand: optionalStr(100),
  description: optionalStr(2000),
  addressLine: optionalStr(255),
  city: optionalStr(100),
  state: optionalStr(100),
  pincode: optionalStr(20),
  country: z.string().trim().min(1).max(100),
  phone: optionalStr(20),
  receptionContact: z.string().trim().min(1, 'Reception contact number is required').max(20),
  roomServiceContact: z.string().trim().min(1, 'Room service contact number is required').max(20),
  email: z.string().trim().email().optional().or(z.literal('')),
  website: optionalStr(255),
  timeZone: z.string().trim().min(1),
  checkInTime: timeString,
  checkOutTime: timeString,
  breakfastTime: timeString.optional().or(z.literal('')),
  restaurantTime: timeString.optional().or(z.literal('')),
})

export type UpdateHotelProfileInput = z.infer<typeof updateHotelProfileSchema>

// GSTIN format: 2-digit state code + 10-char PAN + 1 entity code + 1 checksum digit + 'Z' + 1 checksum char.
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

export const updateHotelLegalSchema = z.object({
  legalBusinessName: optionalStr(200),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z.string().trim().toUpperCase().regex(panRegex, 'Enter a valid 10-character PAN').optional().or(z.literal('')),
  billingAddressLine: optionalStr(255),
  billingCity: optionalStr(100),
  billingState: optionalStr(100),
  billingPincode: optionalStr(20),
  billingCountry: optionalStr(100),
  billingEmail: z.string().trim().email().optional().or(z.literal('')),
})

export type UpdateHotelLegalInput = z.infer<typeof updateHotelLegalSchema>

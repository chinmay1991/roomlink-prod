import { z } from 'zod'

/** Kept in sync with apps/hotel-admin's list — offered as quick-add suggestions here too.
 * Front Office is not offered here — it's mandatory and auto-created for every hotel. */
export const DEFAULT_DEPARTMENT_TEMPLATES = [
  'Housekeeping',
  'Restaurant',
  'Maintenance',
  'Room Service',
  'Laundry',
  'Spa & Wellness',
  'Concierge / Transport',
] as const

export const addDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  isCustom: z.boolean().default(false),
})
export type AddDepartmentInput = z.infer<typeof addDepartmentSchema>

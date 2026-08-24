import { z } from 'zod'
import { uuid } from './common'

/** Front Office is not offered here — it's mandatory and auto-created for every hotel (see hotel-roles.service.ts). */
export const DEFAULT_DEPARTMENT_TEMPLATES = [
  'Housekeeping',
  'Restaurant',
  'Maintenance',
  'Room Service',
  'Laundry',
  'Spa & Wellness',
  'Concierge / Transport',
] as const

export const enableDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  isCustom: z.boolean().default(false),
})
export type EnableDepartmentInput = z.infer<typeof enableDepartmentSchema>

export const renameDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
})
export type RenameDepartmentInput = z.infer<typeof renameDepartmentSchema>

export const assignManagerSchema = z.object({
  managerId: uuid.nullable(),
})
export type AssignManagerInput = z.infer<typeof assignManagerSchema>

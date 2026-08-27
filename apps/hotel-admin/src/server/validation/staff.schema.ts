import { z } from 'zod'
import { uuid } from './common'

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required').max(150),
  employeeId: z.string().trim().max(50).optional().or(z.literal('')),
  mobile: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email'),
  departmentIds: z.array(uuid).optional(),
})
export type CreateStaffInput = z.infer<typeof createStaffSchema>

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  employeeId: z.string().trim().max(50).optional().or(z.literal('')),
  mobile: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email(),
})
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>

export const setStaffDepartmentsSchema = z.object({
  departmentIds: z.array(uuid),
})
export type SetStaffDepartmentsInput = z.infer<typeof setStaffDepartmentsSchema>

export const createReceptionSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required').max(150),
  employeeId: z.string().trim().max(50).optional().or(z.literal('')),
  mobile: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email'),
})
export type CreateReceptionInput = z.infer<typeof createReceptionSchema>

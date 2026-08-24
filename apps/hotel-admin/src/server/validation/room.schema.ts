import { z } from 'zod'

/** Ground floor is entered as "0" — the Front Office dashboard's floor-wise pagination is purely numeric (0-100), so free text like "Floor 1" or "Ground" is no longer accepted here. */
const floorSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || /^\d+$/.test(v), { message: 'Floor must be a whole number' })
  .refine((v) => !v || Number(v) <= 100, { message: 'Floor must be between 0 and 100' })

export const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1, 'Room number is required').max(20),
  floor: floorSchema,
  roomType: z.string().trim().max(100).optional().or(z.literal('')),
  building: z.string().trim().max(100).optional().or(z.literal('')),
})
export type CreateRoomInput = z.infer<typeof createRoomSchema>

export const updateRoomStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'maintenance']),
})
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>

export const updateRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  floor: floorSchema,
  roomType: z.string().trim().max(100).optional().or(z.literal('')),
  building: z.string().trim().max(100).optional().or(z.literal('')),
})
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>

export const bulkImportRoomsSchema = z.object({
  rows: z
    .array(
      z.object({
        roomNumber: z.string().trim().min(1),
        floor: floorSchema,
        roomType: z.string().trim().optional().or(z.literal('')),
        building: z.string().trim().optional().or(z.literal('')),
      })
    )
    .min(1, 'No rows to import')
    .max(500, 'Import at most 500 rooms at a time'),
})
export type BulkImportRoomsInput = z.infer<typeof bulkImportRoomsSchema>

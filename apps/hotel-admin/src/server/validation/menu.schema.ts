import { z } from 'zod'
import { uuid } from './common'

export const DEFAULT_MENU_CATEGORIES = ['Breakfast', 'Starters', 'Main Course', 'Beverages', 'Desserts'] as const

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const createMenuItemSchema = z.object({
  categoryId: uuid,
  name: z.string().trim().min(2, 'Item name is required').max(150),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  isVeg: z.boolean().optional(),
})
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>

export const updateMenuItemSchema = z.object({
  categoryId: uuid,
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  price: z.coerce.number().min(0),
  isVeg: z.boolean().optional(),
})
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>

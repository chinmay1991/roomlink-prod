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

/** One item as Claude reads it off a menu photo — no categoryId yet, since that's a per-hotel choice the admin makes after review. */
export const extractedMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0),
  isVeg: z.boolean().optional(),
})
export type ExtractedMenuItem = z.infer<typeof extractedMenuItemSchema>

export const extractedMenuSchema = z.object({
  items: z.array(extractedMenuItemSchema),
})

const ACCEPTED_IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const extractMenuImageSchema = z.object({
  /** Base64-encoded image data, no data URL prefix. */
  image: z.string().min(1, 'Image is required'),
  mediaType: z.enum(ACCEPTED_IMAGE_MEDIA_TYPES),
})
export type ExtractMenuImageInput = z.infer<typeof extractMenuImageSchema>

export const bulkCreateMenuItemsSchema = z.array(createMenuItemSchema).min(1).max(100)
export type BulkCreateMenuItemsInput = z.infer<typeof bulkCreateMenuItemsSchema>

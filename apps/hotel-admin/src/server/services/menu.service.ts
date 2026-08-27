import { prisma } from '@/server/db'
import { recordAudit } from '@/server/audit'
import { markStepComplete } from '@/server/services/hotel-onboarding.service'
import type { CreateCategoryInput, CreateMenuItemInput, UpdateMenuItemInput } from '@/server/validation/menu.schema'
import type { HotelSessionUser } from '@/server/require-hotel-session'

export async function listCategories(hotelId: string) {
  return prisma.menu_categories.findMany({ where: { hotel_id: hotelId }, orderBy: { display_order: 'asc' } })
}

export async function createCategory(hotelId: string, input: CreateCategoryInput, actor: HotelSessionUser) {
  const count = await prisma.menu_categories.count({ where: { hotel_id: hotelId } })
  const category = await prisma.menu_categories.create({
    data: { hotel_id: hotelId, name: input.name, display_order: count },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'menu_category.created',
    entityType: 'menu_category',
    entityId: category.category_id,
    afterState: { name: category.name },
  })

  return category
}

export async function listMenuItems(hotelId: string) {
  return prisma.menu_items.findMany({
    where: { hotel_id: hotelId },
    orderBy: { name: 'asc' },
    include: { menu_categories: { select: { name: true } } },
  })
}

export async function createMenuItem(hotelId: string, input: CreateMenuItemInput, actor: HotelSessionUser) {
  await prisma.menu_categories.findFirstOrThrow({ where: { category_id: input.categoryId, hotel_id: hotelId } })

  const item = await prisma.menu_items.create({
    data: {
      hotel_id: hotelId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description || null,
      price: input.price,
      is_veg: input.isVeg ?? null,
      status: 'active',
      is_available: true,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'menu_item.created',
    entityType: 'menu_item',
    entityId: item.item_id,
    afterState: { name: item.name, price: item.price.toString() },
  })

  await markStepComplete(hotelId, 'Restaurant Menu')

  return item
}

export async function updateMenuItem(hotelId: string, itemId: string, input: UpdateMenuItemInput, actor: HotelSessionUser) {
  await prisma.menu_items.findFirstOrThrow({ where: { item_id: itemId, hotel_id: hotelId } })
  await prisma.menu_categories.findFirstOrThrow({ where: { category_id: input.categoryId, hotel_id: hotelId } })

  const after = await prisma.menu_items.update({
    where: { item_id: itemId },
    data: {
      category_id: input.categoryId,
      name: input.name,
      description: input.description || null,
      price: input.price,
      is_veg: input.isVeg ?? null,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: 'menu_item.updated',
    entityType: 'menu_item',
    entityId: itemId,
    afterState: { name: after.name, price: after.price.toString() },
  })

  return after
}

/** Admin enable/disable (permanent) — distinct from day-to-day mark-unavailable. */
export async function toggleMenuItemStatus(hotelId: string, itemId: string, actor: HotelSessionUser) {
  const before = await prisma.menu_items.findFirstOrThrow({ where: { item_id: itemId, hotel_id: hotelId } })
  const nextStatus = before.status === 'active' ? 'inactive' : 'active'

  const after = await prisma.menu_items.update({ where: { item_id: itemId }, data: { status: nextStatus } })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: nextStatus === 'active' ? 'menu_item.enabled' : 'menu_item.disabled',
    entityType: 'menu_item',
    entityId: itemId,
    beforeState: { status: before.status },
    afterState: { status: after.status },
  })

  return after
}

/** Day-to-day "86'd" toggle — e.g. kitchen ran out of an ingredient, distinct from disabling the item entirely. */
export async function toggleMenuItemAvailability(hotelId: string, itemId: string, actor: HotelSessionUser) {
  const before = await prisma.menu_items.findFirstOrThrow({ where: { item_id: itemId, hotel_id: hotelId } })

  const after = await prisma.menu_items.update({
    where: { item_id: itemId },
    data: { is_available: !before.is_available },
  })

  await recordAudit({
    actorId: actor.id,
    actorType: actor.userType,
    action: after.is_available ? 'menu_item.marked_available' : 'menu_item.marked_unavailable',
    entityType: 'menu_item',
    entityId: itemId,
  })

  return after
}

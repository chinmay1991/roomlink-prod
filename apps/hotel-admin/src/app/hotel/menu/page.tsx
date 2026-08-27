import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listCategories, listMenuItems } from '@/server/services/menu.service'
import { SectionTabs } from '@/components/layout/section-tabs'
import { MenuItemList } from './menu-item-list'
import { MenuForms } from './menu-forms'
import { MenuImageImport } from './menu-image-import'

export default async function MenuPage() {
  const session = await requireHotelPageSession()
  const hotelId = session.user.hotelId
  const [categories, items] = await Promise.all([listCategories(hotelId), listMenuItems(hotelId)])

  return (
    <div className="space-y-5">
      <SectionTabs section="guest-services" />
      <h1 className="text-xl font-semibold text-slate-900">Restaurant Menu</h1>
      <MenuItemList
        items={items.map((i) => ({
          item_id: i.item_id,
          name: i.name,
          price: i.price.toString(),
          is_veg: i.is_veg,
          is_available: i.is_available,
          status: i.status,
          menu_categories: i.menu_categories,
        }))}
      />
      <MenuImageImport categories={categories} />
      <MenuForms categories={categories} />
    </div>
  )
}

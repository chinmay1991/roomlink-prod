import { requireGuestPageSession } from '@/server/require-guest-page-session'
import { getMe } from '@/server/services/session.service'
import { GuestTopbar } from '@/components/guest-topbar'
import { GuestBottomNav } from '@/components/guest-bottom-nav'
import { CartProvider } from '@/components/cart-context'
import { ChatAlertListener } from '@/components/chat-alert-listener'

/** Every authenticated guest page lives under this route group and shares this shell. */
export default async function GuestAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireGuestPageSession()
  const me = await getMe(ctx)

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <ChatAlertListener />
        <GuestTopbar hotelName={me.hotelName} roomNumber={me.roomNumber} />
        <main className="flex-1 px-4 py-5 pb-24">{children}</main>
        <GuestBottomNav />
      </div>
    </CartProvider>
  )
}

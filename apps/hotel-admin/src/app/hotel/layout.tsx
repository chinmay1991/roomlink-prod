import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { isNativeClient } from '@/server/is-native-client'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { StaffBottomNav } from '@/components/layout/staff-bottom-nav'
import { MobileShell } from '@/components/layout/mobile-shell'
import { VoiceCallListener } from '@/components/layout/voice-call-listener'
import { ReceptionAlertListener } from '@/components/layout/reception-alert-listener'
import { AssignmentAlertListener } from '@/components/layout/assignment-alert-listener'

export default async function HotelPortalLayout({ children }: { children: React.ReactNode }) {
  // hotelName comes off the session (set at login), not a fresh DB lookup —
  // this layout re-runs on every navigation and every PollingRefresh tick
  // (router.refresh() re-renders the whole route tree, layout included), so
  // a query here was firing every 15-20s per open tab for a value that's
  // static for the life of the session (same tradeoff already made for
  // hotelId/roleName/userType elsewhere in the JWT).
  const session = await requireHotelPageSession()

  // Mobile-app plan's isolation mechanism: isNativeClient() is true only
  // inside the Capacitor-wrapped native app's WebView (or the local
  // FORCE_NATIVE_SHELL dev override), never for a real browser — so this
  // branch is provably inert for every existing browser/PWA request, which
  // keeps taking the unchanged path below.
  // Guest calls only ever ring the Reception role (voice-call.service.ts in
  // apps/guest) — hotel_admin is deliberately excluded so a guest call rings
  // the front desk and nowhere else. Mirroring that here means hotel_admin
  // never even logs into ZIM for this, instead of maintaining a live
  // connection for invitations that will never arrive.
  const canReceiveVoiceCalls = session.user.roleName === 'Reception'

  // Same gate as requireReceptionOrAdmin (reception.service.ts) — hotel-wide
  // new-request/new-message alerts belong to whoever can already see the
  // hotel-wide Reception dashboard, not just the Reception role.
  const canReceiveReceptionAlerts = session.user.userType === 'hotel_admin' || session.user.roleName === 'Reception'

  // The only two roles a request can ever be assigned to (assignRequest's
  // eligibility check is `user_departments` membership, which only
  // Department Manager/Staff hold) — hotel_admin/Reception assign work, they
  // don't receive it.
  const canReceiveAssignmentAlerts = session.user.roleName === 'Department Manager' || session.user.roleName === 'Department Staff'

  if (isNativeClient()) {
    return (
      <>
        <VoiceCallListener enabled={canReceiveVoiceCalls} />
        <ReceptionAlertListener enabled={canReceiveReceptionAlerts} />
        <AssignmentAlertListener enabled={canReceiveAssignmentAlerts} />
        <MobileShell roleName={session.user.roleName}>{children}</MobileShell>
      </>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <VoiceCallListener enabled={canReceiveVoiceCalls} />
      <ReceptionAlertListener enabled={canReceiveReceptionAlerts} />
      <AssignmentAlertListener enabled={canReceiveAssignmentAlerts} />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar hotelName={session.user.hotelName} />
        {/* pb-20 leaves room for StaffBottomNav's fixed bar on mobile; it renders null (no bar, no gap needed) for every other role */}
        <main className="flex-1 px-6 py-6 pb-20 md:pb-6">{children}</main>
      </div>
      <StaffBottomNav />
    </div>
  )
}

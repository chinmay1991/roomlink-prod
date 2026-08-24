import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Prisma } from '@roomlink/db'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { getConversation } from '@/server/services/conversations.service'
import { Card, StatusBadge, timeAgo, cn } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'
import { ReplyBox } from './reply-box'

/** Front Office (formerly Reception PRD) §17/§18 — thread + reply, plus a read-only cross-reference to the room's open requests. */
export default async function ConversationDetailPage({ params }: { params: { conversationId: string } }) {
  const session = await requireHotelPageSession()
  const hotelId = session.user.hotelId

  const data = await getConversation(hotelId, params.conversationId).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null
    throw error
  })
  if (!data) notFound()

  const { conversation, messages, relatedRequests } = data

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={15} />
      <Link href="/hotel/front-office-desk/conversations" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Back to conversations
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Room {conversation.rooms?.room_number ?? '—'} {conversation.guests?.full_name ? `— ${conversation.guests.full_name}` : ''}
        </h1>
      </div>

      <Card className="max-h-[50vh] space-y-3 overflow-y-auto p-5">
        {messages.map((m) => (
          <div key={m.message_id} className={cn('max-w-[80%]', m.sender_type === 'staff' ? 'ml-auto text-right' : '')}>
            <p
              className={cn(
                'inline-block rounded-lg px-3.5 py-2 text-sm',
                m.sender_type === 'staff' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
              )}
            >
              {m.content}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {m.sender_type === 'guest' ? 'Guest' : 'Front Office'} · {timeAgo(m.sent_at)}
            </p>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-sm text-slate-500">No messages yet.</p>}
      </Card>

      <ReplyBox conversationId={conversation.conversation_id} />

      {relatedRequests.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Open requests for this room</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {relatedRequests.map((r) => (
              <li key={r.request_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-700">
                  {r.request_type} <span className="text-slate-400">— {r.departments?.name ?? 'Unassigned'}</span>
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

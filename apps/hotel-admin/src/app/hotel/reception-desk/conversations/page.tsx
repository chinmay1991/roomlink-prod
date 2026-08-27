import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'
import { requireHotelPageSession } from '@/server/require-hotel-page-session'
import { listConversations } from '@/server/services/conversations.service'
import { Card, timeAgo } from '@roomlink/ui'
import { PollingRefresh } from '@/components/layout/polling-refresh'

/** Reception PRD §17 — hotel-wide conversation inbox, unread (unanswered guest message) first. */
export default async function ConversationsPage() {
  const session = await requireHotelPageSession()
  const conversations = await listConversations(session.user.hotelId)

  const sorted = [...conversations].sort((a, b) => Number(b.hasUnreadGuestMessage) - Number(a.hasUnreadGuestMessage))

  return (
    <div className="space-y-5">
      <PollingRefresh intervalSeconds={20} />
      <h1 className="text-xl font-semibold text-slate-900">Conversations</h1>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {sorted.map((c) => (
            <li key={c.conversation_id}>
              <Link href={`/hotel/reception-desk/conversations/${c.conversation_id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50">
                <MessageSquareText
                  className={`mt-0.5 h-4 w-4 shrink-0 ${c.hasUnreadGuestMessage ? 'text-brand-600' : 'text-slate-300'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      Room {c.rooms?.room_number ?? '—'} {c.guests?.full_name ? `— ${c.guests.full_name}` : ''}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">{c.lastMessage ? timeAgo(c.lastMessage.sent_at) : timeAgo(c.created_at)}</span>
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {c.lastMessage ? `${c.lastMessage.sender_type === 'guest' ? 'Guest' : 'You'}: ${c.lastMessage.content}` : 'No messages yet'}
                  </p>
                </div>
                {c.hasUnreadGuestMessage && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              </Link>
            </li>
          ))}
          {sorted.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No conversations yet.</li>}
        </ul>
      </Card>
    </div>
  )
}

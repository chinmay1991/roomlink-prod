import { requireGuestPageSession } from '@/server/require-guest-page-session'
import { getGuestConversation } from '@/server/services/conversations.service'
import { MessageThread } from './message-thread'
import { VoiceCallButton } from './voice-call-button'

/** Guest PRD §10 — start/continue a conversation with Reception. */
export default async function ReceptionPage() {
  const ctx = await requireGuestPageSession()
  const conversation = await getGuestConversation(ctx)

  const messages = (conversation?.messages ?? []).map((m) => ({
    message_id: m.message_id,
    sender_type: m.sender_type,
    content: m.content,
    sent_at: m.sent_at.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Contact Reception</h1>
      <VoiceCallButton />
      <MessageThread initialMessages={messages} />
    </div>
  )
}

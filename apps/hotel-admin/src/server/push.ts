import { getDeviceTokensForRecipient } from '@/server/services/device-tokens.service'

export type PushPayload = { title: string; body: string; url?: string }

/**
 * Registration (device-tokens.service.ts + the /api/v1/hotel/device-tokens
 * route), targeting, and the trigger call (requests.service.ts's
 * escalateRequest) are all real and wired up. Actual delivery isn't: FCM
 * (Android) needs a Firebase project + firebase-admin, and APNs (iOS) needs
 * an Apple Developer Program membership + a signing library — both require
 * external accounts this repo doesn't have yet. Until then this logs what
 * would have been sent, which is enough to verify the whole trigger path
 * fires correctly end to end. Once those credentials exist, branch on each
 * token's `platform` here and call the respective API.
 */
export async function sendPushToRecipient(hotelId: string, recipient: 'gm' | 'front_office', payload: PushPayload): Promise<void> {
  const tokens = await getDeviceTokensForRecipient(hotelId, recipient)
  if (tokens.length === 0) return

  console.warn(
    `[push] Not yet configured — would notify ${tokens.length} device(s) (${recipient}, hotel ${hotelId}): "${payload.title}" — ${payload.body}`
  )
}

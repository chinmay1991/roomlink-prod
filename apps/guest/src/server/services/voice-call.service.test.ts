import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateLimitedError } from '@/server/errors'
import { startVoiceCall, endVoiceCall, guestZegoUserId, staffZegoUserId } from './voice-call.service'

const mockPrisma = vi.hoisted(() => ({
  call_logs: { count: vi.fn(), create: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn() },
  users: { findMany: vi.fn() },
  guest_sessions: { findUniqueOrThrow: vi.fn() },
}))

vi.mock('@/server/db', () => ({ prisma: mockPrisma }))
vi.mock('@/server/audit', () => ({ recordAudit: vi.fn() }))
// shortZegoId stays real (imported via importOriginal) — it's what this
// suite is actually guarding: ZegoCloud caps userID at 32 bytes, so a raw
// UUID with a prefix (42 bytes) must never reach the SDK again.
vi.mock('@/server/zego-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/zego-token')>()),
  generateZegoToken: vi.fn(() => 'fake-token'),
  getZegoAppId: vi.fn(() => 123),
}))

const CTX = { sessionId: 'session-1', hotelId: 'hotel-1', roomId: 'room-1', guestId: 'guest-1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.call_logs.count.mockResolvedValue(0)
  mockPrisma.users.findMany.mockResolvedValue([{ user_id: 'staff-1' }, { user_id: 'staff-2' }])
  mockPrisma.call_logs.create.mockResolvedValue({ call_log_id: 'call-1', zego_room_id: 'call_hotel-1_room-1_abc' })
  mockPrisma.guest_sessions.findUniqueOrThrow.mockResolvedValue({
    rooms: { room_number: '204' },
    guests: { full_name: 'Jane Doe' },
  })
})

describe('startVoiceCall', () => {
  it('rings only Reception-role staff at this hotel — not hotel_admin or any other role', async () => {
    const result = await startVoiceCall(CTX)

    expect(mockPrisma.users.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hotel_id: 'hotel-1',
          roles: { name: 'Reception' },
        }),
      }),
    )
    expect(result.calleeIds).toEqual([staffZegoUserId('staff-1'), staffZegoUserId('staff-2')])
    expect(result.userId).toBe(guestZegoUserId('session-1'))
  })

  it('includes the caller room number and guest name for Reception\'s incoming-call popup', async () => {
    const result = await startVoiceCall(CTX)

    expect(result.roomNumber).toBe('204')
    expect(result.guestName).toBe('Jane Doe')
    expect(result.userName).toBe('Room 204 (Jane Doe)')
  })

  it('falls back to just the room number when the stay has no linked guest', async () => {
    mockPrisma.guest_sessions.findUniqueOrThrow.mockResolvedValue({ rooms: { room_number: '204' }, guests: null })

    const result = await startVoiceCall(CTX)

    expect(result.guestName).toBeNull()
    expect(result.userName).toBe('Room 204')
  })

  it('keeps every zego user id at or under the 32-byte limit ZegoCloud enforces, even for a full-length UUID source id', async () => {
    const uuid = 'd19857b3-6fe3-4ba2-a351-9f4400239173'
    expect(Buffer.byteLength(guestZegoUserId(uuid))).toBeLessThanOrEqual(32)
    expect(Buffer.byteLength(staffZegoUserId(uuid))).toBeLessThanOrEqual(32)
  })

  it('scopes the created call log to this hotel/room/guest session, not client-asserted values', async () => {
    await startVoiceCall(CTX)

    expect(mockPrisma.call_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hotel_id: 'hotel-1',
          room_id: 'room-1',
          guest_session_id: 'session-1',
          status: 'ringing',
        }),
      }),
    )
  })

  it('rejects a 6th call within the rate-limit window instead of ringing reception again', async () => {
    mockPrisma.call_logs.count.mockResolvedValue(5)

    await expect(startVoiceCall(CTX)).rejects.toThrow(RateLimitedError)
    expect(mockPrisma.call_logs.create).not.toHaveBeenCalled()
  })
})

describe('endVoiceCall', () => {
  it('marks a still-ringing call as missed, not ended, when the guest hangs up first', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'ringing' })

    await endVoiceCall(CTX, 'call-1')

    expect(mockPrisma.call_logs.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { call_log_id: 'call-1', guest_session_id: 'session-1' } }),
    )
    expect(mockPrisma.call_logs.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'missed' }) }),
    )
  })

  it('marks an answered call as ended', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'answered' })

    await endVoiceCall(CTX, 'call-1')

    expect(mockPrisma.call_logs.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ended' }) }),
    )
  })

  it('is a no-op on an already-terminal call log', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'declined' })

    await endVoiceCall(CTX, 'call-1')

    expect(mockPrisma.call_logs.update).not.toHaveBeenCalled()
  })
})

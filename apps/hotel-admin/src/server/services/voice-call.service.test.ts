import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenError } from '@/server/hotel-rbac'
import { InvalidTransitionError } from '@/server/errors'
import { getStaffVoiceCallToken, answerVoiceCall, declineVoiceCall, listCallLogs, staffZegoUserId } from './voice-call.service'

const mockPrisma = vi.hoisted(() => ({
  call_logs: { findFirstOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/server/db', () => ({ prisma: mockPrisma }))
// shortZegoId stays real (imported via importOriginal) — it's what this
// suite is actually guarding: ZegoCloud caps userID at 32 bytes, so a raw
// UUID with a prefix (42 bytes) must never reach the SDK again.
vi.mock('@/server/zego-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/zego-token')>()),
  generateZegoToken: vi.fn(() => 'fake-token'),
  getZegoAppId: vi.fn(() => 123),
}))

const FRONT_OFFICE = { id: 'user-1', userType: 'hotel_staff', roleId: 'role-1', roleName: 'Front Office Staff', hotelId: 'hotel-1' } as const
const FRONT_OFFICE_MANAGER = { id: 'user-4', userType: 'hotel_staff', roleId: 'role-4', roleName: 'Front Office Manager', hotelId: 'hotel-1' } as const
const ADMIN = { id: 'user-2', userType: 'hotel_admin', roleId: 'role-2', roleName: 'Hotel Admin', hotelId: 'hotel-1' } as const
const DEPT_STAFF = { id: 'user-3', userType: 'hotel_staff', roleId: 'role-3', roleName: 'Department Staff', hotelId: 'hotel-1' } as const

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getStaffVoiceCallToken', () => {
  it('rejects non-Front-Office, non-admin staff', () => {
    expect(() => getStaffVoiceCallToken(DEPT_STAFF)).toThrow(ForbiddenError)
  })

  it('issues a token for Front Office (Staff or Manager) and hotel_admin staff', () => {
    expect(getStaffVoiceCallToken(FRONT_OFFICE).userId).toBe(staffZegoUserId('user-1'))
    expect(getStaffVoiceCallToken(ADMIN).userId).toBe(staffZegoUserId('user-2'))
    expect(getStaffVoiceCallToken(FRONT_OFFICE_MANAGER).userId).toBe(staffZegoUserId('user-4'))
  })

  it('keeps the zego user id at or under the 32-byte limit ZegoCloud enforces, even for a full-length UUID source id', () => {
    const uuid = '5165ed48-c80c-48c8-8cdb-d58d9bbc4c54'
    expect(Buffer.byteLength(staffZegoUserId(uuid))).toBeLessThanOrEqual(32)
  })
})

describe('answerVoiceCall', () => {
  it('rejects non-Front-Office, non-admin staff before touching the DB', async () => {
    await expect(answerVoiceCall(DEPT_STAFF, 'room-1')).rejects.toThrow(ForbiddenError)
    expect(mockPrisma.call_logs.findFirstOrThrow).not.toHaveBeenCalled()
  })

  it('looks up by zego_room_id (the only id the answering client knows) scoped to the caller’s own hotel, not a client-asserted one', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'ringing', zego_room_id: 'room-1' })
    mockPrisma.call_logs.update.mockResolvedValue({ call_log_id: 'call-1', status: 'answered', zego_room_id: 'room-1' })

    await answerVoiceCall(FRONT_OFFICE, 'room-1')

    expect(mockPrisma.call_logs.findFirstOrThrow).toHaveBeenCalledWith({
      where: { zego_room_id: 'room-1', hotel_id: 'hotel-1' },
    })
  })

  it('first-to-answer wins: rejects answering a call that is no longer ringing', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'answered', zego_room_id: 'room-1' })

    await expect(answerVoiceCall(FRONT_OFFICE, 'room-1')).rejects.toThrow(InvalidTransitionError)
    expect(mockPrisma.call_logs.update).not.toHaveBeenCalled()
  })

  it('records who answered', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'ringing', zego_room_id: 'room-1' })
    mockPrisma.call_logs.update.mockResolvedValue({ call_log_id: 'call-1', status: 'answered', zego_room_id: 'room-1' })

    await answerVoiceCall(FRONT_OFFICE, 'room-1')

    expect(mockPrisma.call_logs.update).toHaveBeenCalledWith({
      where: { call_log_id: 'call-1' },
      data: expect.objectContaining({ status: 'answered', answered_by: 'user-1' }),
    })
  })
})

describe('declineVoiceCall', () => {
  it('never mutates the shared call log — one decline must not end the call for everyone else being rung', async () => {
    mockPrisma.call_logs.findFirstOrThrow.mockResolvedValue({ call_log_id: 'call-1', status: 'ringing', zego_room_id: 'room-1' })

    await declineVoiceCall(FRONT_OFFICE, 'room-1')

    expect(mockPrisma.call_logs.update).not.toHaveBeenCalled()
  })
})

describe('listCallLogs', () => {
  it('rejects non-Front-Office, non-admin staff', async () => {
    await expect(listCallLogs('hotel-1', DEPT_STAFF)).rejects.toThrow(ForbiddenError)
  })

  it('scopes to the given hotel, most recent first', async () => {
    mockPrisma.call_logs.findMany.mockResolvedValue([])
    await listCallLogs('hotel-1', FRONT_OFFICE)

    expect(mockPrisma.call_logs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hotel_id: 'hotel-1' }, orderBy: { initiated_at: 'desc' } }),
    )
  })

  it('caps to the given limit for the dashboard panel, but is uncapped when omitted for the full Call Logs page', async () => {
    mockPrisma.call_logs.findMany.mockResolvedValue([])

    await listCallLogs('hotel-1', FRONT_OFFICE, 5)
    expect(mockPrisma.call_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))

    await listCallLogs('hotel-1', FRONT_OFFICE)
    expect(mockPrisma.call_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: undefined }))
  })
})

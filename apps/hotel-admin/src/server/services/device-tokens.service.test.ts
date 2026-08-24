import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerDeviceToken, unregisterDeviceToken, getDeviceTokensForRecipient } from './device-tokens.service'

const mockPrisma = vi.hoisted(() => ({
  device_tokens: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/server/db', () => ({ prisma: mockPrisma }))

const ACTOR = { id: 'user-1', userType: 'hotel_admin', roleId: 'role-1', roleName: 'Hotel Admin', hotelId: 'hotel-1' } as const

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerDeviceToken', () => {
  it('upserts on the token, scoping to the calling hotel/user', async () => {
    await registerDeviceToken('hotel-1', { token: 'abc', platform: 'android' }, ACTOR)

    expect(mockPrisma.device_tokens.upsert).toHaveBeenCalledWith({
      where: { token: 'abc' },
      create: { hotel_id: 'hotel-1', user_id: 'user-1', platform: 'android', token: 'abc' },
      update: expect.objectContaining({ hotel_id: 'hotel-1', user_id: 'user-1', platform: 'android' }),
    })
  })
})

describe('unregisterDeviceToken', () => {
  it('scopes deletion to the caller — one user can never unregister another’s token', async () => {
    await unregisterDeviceToken('user-1', 'abc')
    expect(mockPrisma.device_tokens.deleteMany).toHaveBeenCalledWith({ where: { token: 'abc', user_id: 'user-1' } })
  })
})

describe('getDeviceTokensForRecipient', () => {
  it('targets hotel_admin userType for the "gm" recipient, not a role name', async () => {
    mockPrisma.device_tokens.findMany.mockResolvedValue([])
    await getDeviceTokensForRecipient('hotel-1', 'gm')

    expect(mockPrisma.device_tokens.findMany).toHaveBeenCalledWith({
      where: { hotel_id: 'hotel-1', users: { user_type: 'hotel_admin' } },
      select: { token: true, platform: true },
    })
  })

  it('targets both Front Office roles for the "front_office" recipient', async () => {
    mockPrisma.device_tokens.findMany.mockResolvedValue([])
    await getDeviceTokensForRecipient('hotel-1', 'front_office')

    expect(mockPrisma.device_tokens.findMany).toHaveBeenCalledWith({
      where: { hotel_id: 'hotel-1', users: { roles: { name: { in: ['Front Office Manager', 'Front Office Staff'] } } } },
      select: { token: true, platform: true },
    })
  })
})

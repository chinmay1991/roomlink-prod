import { describe, it, expect } from 'vitest'
import { toGuestRequestStatus, GUEST_REQUEST_STATUS_LABEL, GUEST_ORDER_STATUS_LABEL } from './guest-status'

describe('toGuestRequestStatus (Guest PRD §13/§37 — hide internal-only states)', () => {
  it('passes through every guest-facing status unchanged', () => {
    expect(toGuestRequestStatus('pending')).toBe('pending')
    expect(toGuestRequestStatus('assigned')).toBe('assigned')
    expect(toGuestRequestStatus('in_progress')).toBe('in_progress')
    expect(toGuestRequestStatus('completed')).toBe('completed')
    expect(toGuestRequestStatus('cancelled')).toBe('cancelled')
  })

  it('maps the internal-only "escalated" status onto "in_progress"', () => {
    expect(toGuestRequestStatus('escalated')).toBe('in_progress')
  })

  it('maps the internal-only "pending_acceptance" status onto "assigned"', () => {
    expect(toGuestRequestStatus('pending_acceptance')).toBe('assigned')
  })

  it('every mapped status has a guest-facing label', () => {
    for (const status of ['pending', 'assigned', 'in_progress', 'completed', 'cancelled']) {
      expect(GUEST_REQUEST_STATUS_LABEL[toGuestRequestStatus(status)]).toBeTruthy()
    }
    expect(GUEST_REQUEST_STATUS_LABEL[toGuestRequestStatus('escalated')]).toBe(GUEST_REQUEST_STATUS_LABEL['in_progress'])
  })
})

describe('GUEST_ORDER_STATUS_LABEL (Guest PRD §17 — reuse the existing order_status enum, no "accepted" state)', () => {
  it('covers every value the order_status enum actually has', () => {
    for (const status of ['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']) {
      expect(GUEST_ORDER_STATUS_LABEL[status]).toBeTruthy()
    }
  })
})

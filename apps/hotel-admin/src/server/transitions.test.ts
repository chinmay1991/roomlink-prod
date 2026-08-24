import { describe, it, expect } from 'vitest'
import { REQUEST_TRANSITIONS, canTransition } from './transitions'

describe('request status transitions (PRD §17)', () => {
  it('follows pending -> assigned handling is done via assignRequest, not a status transition', () => {
    // pending -> in_progress is allowed directly (Front Office/manager can start work without a
    // separate "assigned" step if they're doing it themselves)
    expect(canTransition(REQUEST_TRANSITIONS, 'pending', 'in_progress')).toBe(true)
  })

  it('follows assigned -> in_progress -> completed', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'assigned', 'in_progress')).toBe(true)
    expect(canTransition(REQUEST_TRANSITIONS, 'in_progress', 'completed')).toBe(true)
  })

  it('rejects completing a request that was never started', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'pending', 'completed')).toBe(false)
    expect(canTransition(REQUEST_TRANSITIONS, 'assigned', 'completed')).toBe(false)
  })

  it('treats completed and cancelled as terminal', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'completed', 'in_progress')).toBe(false)
    expect(canTransition(REQUEST_TRANSITIONS, 'cancelled', 'in_progress')).toBe(false)
  })

  it('allows escalating from any active state and recovering from escalation', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'pending', 'escalated')).toBe(true)
    expect(canTransition(REQUEST_TRANSITIONS, 'in_progress', 'escalated')).toBe(true)
    expect(canTransition(REQUEST_TRANSITIONS, 'escalated', 'in_progress')).toBe(true)
  })

  it('does not allow escalating an already-completed request', () => {
    expect(canTransition(REQUEST_TRANSITIONS, 'completed', 'escalated')).toBe(false)
  })
})

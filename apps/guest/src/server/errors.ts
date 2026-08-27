/** No valid guest session cookie, or it doesn't resolve to an active `guest_sessions` row. */
export class UnauthorizedError extends Error {}

/** Thrown when a required deployment/env-config value is missing or invalid — an ops problem, not a client error. */
export class ConfigurationError extends Error {}

/**
 * The submitted mobile number doesn't match the active stay's registered
 * number for this room — distinct from a missing/expired session cookie,
 * needs its own message. Never reveals the stored number, its last digits,
 * or whether a number is registered for a different room.
 */
export class MobileMismatchError extends Error {
  constructor() {
    super('This mobile number is not registered for the active stay in this room. Please contact Reception.')
  }
}

/** Too many failed mobile-number verification attempts for this room's active stay — locked out until `retryAfterSeconds` elapses. */
export class RateLimitedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('Too many incorrect attempts. Please try again later or contact Reception.')
  }
}

/** A valid session exists but the requested action/resource isn't permitted for it. */
export class ForbiddenError extends Error {}

/** The room/QR is identifiable but not currently usable (inactive room, no active stay). */
export class SessionNotActiveError extends Error {
  constructor(public reason: 'invalid_qr' | 'room_inactive' | 'no_active_stay', message: string) {
    super(message)
  }
}

/** Thrown when an action would move an entity to a state its current state doesn't allow. */
export class InvalidTransitionError extends Error {}

/** Thrown when a required deployment/env-config value is missing or invalid — an ops problem, not a client error. */
export class ConfigurationError extends Error {}

/** Thrown when a guest mobile number can't be normalized into a valid E.164 number. */
export class InvalidPhoneError extends Error {
  constructor() {
    super('Enter a valid mobile number, e.g. +919876543210.')
  }
}

/** Thrown when reading menu items off an uploaded photo fails or finds nothing usable. */
export class MenuExtractionError extends Error {}

const E164_REGEX = /^\+[1-9]\d{6,14}$/

/**
 * This pilot's hotels are all India-based, so a number typed without a `+`
 * (the natural way a guest types their own number on their own phone) is
 * assumed to be a local Indian number and gets `+91` prepended. Front Office's
 * input (expected in full E.164) and the guest's input both funnel through
 * this same function before comparison — never compare raw, unnormalized
 * values.
 */
const DEFAULT_COUNTRY_CODE = '91'

/** Returns the normalized E.164 form, or `null` if the input can't be parsed into one. */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.trim().replace(/[\s\-().]/g, '')
  if (!stripped) return null

  let candidate = stripped
  if (candidate.startsWith('00')) candidate = `+${candidate.slice(2)}`
  if (!candidate.startsWith('+')) candidate = `+${DEFAULT_COUNTRY_CODE}${candidate.replace(/^0+/, '')}`

  return E164_REGEX.test(candidate) ? candidate : null
}

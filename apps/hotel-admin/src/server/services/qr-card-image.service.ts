import sharp from 'sharp'
import QRCode from 'qrcode'
import { QR_CARD_TEMPLATE_BASE64 } from '@/assets/qr-card-template.base64'

// Embedded directly as a base64 module constant rather than read from a
// separate file at request time: on Vercel, neither process.cwd() (public/
// is deployed to the static/CDN layer, not the function's own filesystem)
// nor __dirname (webpack relocates this module into a shared server chunk,
// so __dirname no longer points at the source tree) reliably resolve to the
// asset at runtime — both were tried and both 404/ENOENT'd in a production
// build. Baking the bytes into the compiled module sidesteps path
// resolution entirely.
const TEMPLATE_BUFFER = Buffer.from(QR_CARD_TEMPLATE_BASE64, 'base64')
const TEMPLATE_WIDTH = 1024
const TEMPLATE_HEIGHT = 1536

/**
 * Pixel regions calibrated by sampling public/qr-card-template.png directly
 * (1024x1536 artwork): the LCD plaque where the hotel name sits, the
 * "ROOM ###" pill's digits, and the white card the QR code sits on. Everything
 * else in the template (handset, services list, RoomLink footer, hardware
 * details) is fixed artwork and rendered as-is.
 */
const HOTEL_NAME_BOX = { left: 375, top: 190, width: 530, height: 75 }
const HOTEL_NAME_BG = '#c4c7ae'
const ROOM_NUMBER_BOX = { left: 650, top: 378, width: 76, height: 44 }
const ROOM_NUMBER_BG = '#c29a56'
const QR_BOX = { left: 332, top: 602, size: 340 }

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const HOTEL_NAME_MAX_FONT_SIZE = 44
const HOTEL_NAME_MIN_FONT_SIZE = 16
const HOTEL_NAME_LETTER_SPACING_RATIO = 6 / 44
const HOTEL_NAME_PADDING = 16

// Empirically measured against this exact font stack/weight (rendered via
// sharp/librsvg and measured pixel-by-pixel — see the calibration script in
// the PR): glyphWidth ≈ 0.72 * fontSize for this bold serif uppercase font.
// librsvg (sharp's SVG renderer) does NOT implement textLength/lengthAdjust
// — text silently overflows past it — so the font size has to be solved for
// directly instead of relying on the SVG spec's auto-fit attributes.
const GLYPH_WIDTH_RATIO = 0.72

function renderedWidth(length: number, fontSize: number) {
  return length * fontSize * GLYPH_WIDTH_RATIO + Math.max(0, length - 1) * fontSize * HOTEL_NAME_LETTER_SPACING_RATIO
}

/** Largest font size (up to the "designed" max) whose rendered width fits availableWidth at this length. */
function fitFontSize(length: number, availableWidth: number) {
  const denom = length * GLYPH_WIDTH_RATIO + Math.max(0, length - 1) * HOTEL_NAME_LETTER_SPACING_RATIO
  const fitted = denom > 0 ? availableWidth / denom : HOTEL_NAME_MAX_FONT_SIZE
  return Math.min(HOTEL_NAME_MAX_FONT_SIZE, Math.max(HOTEL_NAME_MIN_FONT_SIZE, fitted))
}

/**
 * Names that still wouldn't fit even at the minimum legible font size get
 * truncated with an ellipsis instead of clipping off-canvas — this is rare
 * (needs a ~35+ character name) but the LCD screen has a hard physical edge.
 */
function fitNameToBox(nameUpper: string, availableWidth: number) {
  if (renderedWidth(nameUpper.length, HOTEL_NAME_MIN_FONT_SIZE) <= availableWidth) {
    return { text: nameUpper, fontSize: fitFontSize(nameUpper.length, availableWidth) }
  }
  let truncated = nameUpper
  while (truncated.length > 1 && renderedWidth(truncated.length + 1, HOTEL_NAME_MIN_FONT_SIZE) > availableWidth) {
    truncated = truncated.slice(0, -1)
  }
  return { text: `${truncated.trimEnd()}…`, fontSize: HOTEL_NAME_MIN_FONT_SIZE }
}

function overlaySvg(hotelName: string, roomNumber: string) {
  const availableWidth = HOTEL_NAME_BOX.width - HOTEL_NAME_PADDING * 2
  const { text: nameUpper, fontSize } = fitNameToBox(hotelName.toUpperCase(), availableWidth)
  const letterSpacing = fontSize * HOTEL_NAME_LETTER_SPACING_RATIO
  const nameCenterX = HOTEL_NAME_BOX.left + HOTEL_NAME_BOX.width / 2
  const nameCenterY = HOTEL_NAME_BOX.top + HOTEL_NAME_BOX.height / 2 + fontSize * 0.32

  // Left-aligned with a small inset (not centered in ROOM_NUMBER_BOX) so the
  // digits sit right after "ROOM" like the original artwork, regardless of
  // exactly how wide the rendered digits turn out to be.
  const roomTextX = ROOM_NUMBER_BOX.left + 4
  const roomCenterY = ROOM_NUMBER_BOX.top + ROOM_NUMBER_BOX.height / 2 + 10

  return `<svg width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <filter id="patchBlend" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation="3.5" />
    </filter>

    <rect x="${HOTEL_NAME_BOX.left}" y="${HOTEL_NAME_BOX.top}" width="${HOTEL_NAME_BOX.width}" height="${HOTEL_NAME_BOX.height}" fill="${HOTEL_NAME_BG}" filter="url(#patchBlend)" />
    <text
      x="${nameCenterX}" y="${nameCenterY}"
      text-anchor="middle"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${fontSize}"
      font-weight="700"
      letter-spacing="${letterSpacing}"
      fill="#0c1628"
    >${escapeXml(nameUpper)}</text>

    <rect x="${ROOM_NUMBER_BOX.left}" y="${ROOM_NUMBER_BOX.top}" width="${ROOM_NUMBER_BOX.width}" height="${ROOM_NUMBER_BOX.height}" fill="${ROOM_NUMBER_BG}" filter="url(#patchBlend)" />
    <text
      x="${roomTextX}" y="${roomCenterY}"
      text-anchor="start"
      font-family="Arial, Helvetica, sans-serif"
      font-size="26"
      font-weight="700"
      fill="#0c0b09"
    >${escapeXml(roomNumber)}</text>
  </svg>`
}

/**
 * Composites the hotel's real name, the room number, and a room-specific QR
 * code onto the designer-provided phone-card template artwork, producing a
 * single print-ready PNG that matches the reference template exactly (same
 * handset, services list, and branding — only these three fields change).
 */
export async function generateRoomQrCardImage({
  hotelName,
  roomNumber,
  qrPayload,
}: {
  hotelName: string
  roomNumber: string
  qrPayload: string
}): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', width: QR_BOX.size * 2, margin: 1 })
  const qrResized = await sharp(qrPng).resize(QR_BOX.size, QR_BOX.size).toBuffer()

  return sharp(TEMPLATE_BUFFER)
    .composite([
      { input: Buffer.from(overlaySvg(hotelName, roomNumber)), left: 0, top: 0 },
      { input: qrResized, left: QR_BOX.left, top: QR_BOX.top },
    ])
    .png()
    .toBuffer()
}

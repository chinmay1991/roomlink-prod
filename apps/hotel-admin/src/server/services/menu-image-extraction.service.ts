import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ConfigurationError, MenuExtractionError } from '@/server/errors'
import { extractedMenuSchema, type ExtractedMenuItem, type ExtractMenuImageInput } from '@/server/validation/menu.schema'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConfigurationError('ANTHROPIC_API_KEY is not configured')
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

const EXTRACTION_PROMPT = `This image shows a restaurant menu (photographed or a menu card/PDF page rendered as an image). Read every dish/drink you can find and extract it.

For each item, capture:
- name: the item's name, as written
- description: any description text under/beside the name, if present (omit if there is none)
- price: the numeric price only — no currency symbol, no commas (e.g. "₹1,250" → 1250, "$12.50" → 12.5)
- isVeg: true if there's a vegetarian marker (a green dot/square, "Veg", "V"), false if there's a non-veg marker (a red/brown marker, "Non-Veg", "NV"), omit if there's no marker at all

Skip section headers, page decoration, and anything that isn't an individually priced item. If the same item appears with multiple size/price variants, list it once with its base/smallest price.`

/** Reads menu items off an uploaded photo via Claude vision — no DB writes, no category assignment (the admin picks categories after reviewing the results). */
export async function extractMenuItemsFromImage(input: ExtractMenuImageInput): Promise<ExtractedMenuItem[]> {
  const anthropic = getClient()

  let response
  try {
    response = await anthropic.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.image } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(extractedMenuSchema) },
    })
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new MenuExtractionError('Could not read that image. Try a clearer photo of the menu.')
    }
    throw error
  }

  if (response.stop_reason === 'refusal') {
    throw new MenuExtractionError('Could not read that image. Try a clearer photo of the menu.')
  }
  if (!response.parsed_output) {
    throw new MenuExtractionError('Could not read that image. Try a clearer photo of the menu.')
  }
  if (response.parsed_output.items.length === 0) {
    throw new MenuExtractionError('No menu items were found in that image.')
  }

  return response.parsed_output.items
}

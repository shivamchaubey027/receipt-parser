import type { ParseResult, ProviderName } from "../../types";

// ─────────────────────────────────────────────────────────────────────────────
// VisionParser interface — every LLM adapter implements this contract.
// The rest of the pipeline is completely unaware of which provider runs.
// ─────────────────────────────────────────────────────────────────────────────

export interface VisionParser {
  readonly name: ProviderName;
  parseReceipt(imageBuffer: Buffer, mimeType: string): Promise<ParseResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared prompt template — versioned, injected into every provider adapter.
// Keeping the prompt centralised means all providers use the exact same
// instructions; adapter code handles only API wiring.
// ─────────────────────────────────────────────────────────────────────────────

export const RECEIPT_PROMPT = `You are a precise JSON parsing API. Your job is to extract data from receipt images.
Return ONLY valid JSON matching this exact schema:
{
  "merchant": "string or null",
  "category": "string (e.g. Dining, Groceries, Transport, Office, Utilities, Retail) or null",
  "currency": "string (3-letter ISO code e.g. USD, INR, EUR) or null",
  "date": "string (YYYY-MM-DD) or null",
  "line_items": [
    { "name": "string", "amount": number }
  ],
  "total": number or null,
  "confidence": "high" | "medium" | "low",
  "low_confidence_fields": ["array", "of", "field", "names"],
  "notes": "<any important extraction notes or null>"
}

Rules:
- amounts are always numbers (no currency symbols)
- date must be ISO-8601 (YYYY-MM-DD) if parseable, otherwise null
- confidence is "high" when all fields are clearly legible
- confidence is "medium" when 1–2 fields are ambiguous
- Do not include subtotal, tax, or tip in line_items unless they are the ONLY items.
- Guess the broad spending "category" based on the merchant and items
- Identify the standard 3-letter currency code (e.g. "USD", "INR", "EUR") from the symbol
- If the image is utterly illegible, return nulls and "low" confidence.
- low_confidence_fields lists field names where you are uncertain
- return null for any field you cannot determine
- NEVER invent data; prefer null over a guess`;

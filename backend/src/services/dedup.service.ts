import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication helpers.
//
// sha256 of the raw upload buffer (before normalisation) is used as the
// dedup key. This ensures uploading the same physical image always hits cache,
// even if the server restarts or the file is moved.
//
// Using the pre-normalisation buffer means the hash is stable regardless of
// any image processing we apply before sending to the LLM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hex digest of an arbitrary buffer.
 * Deterministic, collision-resistant, and fast for file-sized inputs.
 */
export function computeImageHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

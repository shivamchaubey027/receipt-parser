import type { VisionParser } from "./llm/provider";
import type {
    ParseResult,
    ParseAttemptRecord,
    ExtractionResult,
    ProviderName,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Extraction orchestrator.
//
// Implements the full pipeline from the RFC:
//   primary provider → schema validation → fallback provider → failed state
//
// Every provider invocation is timed and logged as a ParseAttemptRecord.
// The caller receives a complete ExtractionResult regardless of success/failure,
// which includes all attempt metadata for observability persistence.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a single provider attempt and return the timed result.
 * All errors are caught — callers decide whether to try the fallback.
 */
async function runProviderAttempt(
    parser: VisionParser,
    imageBuffer: Buffer,
    mimeType: string
): Promise<{ result: ParseResult | null; attempt: ParseAttemptRecord }> {
    const start = Date.now();

    try {
        const result = await parser.parseReceipt(imageBuffer, mimeType);
        const latency_ms = Date.now() - start;

        return {
            result,
            attempt: {
                provider: parser.name,
                success: true,
                latency_ms,
            },
        };
    } catch (err) {
        const latency_ms = Date.now() - start;
        const errorMessage = err instanceof Error ? err.message : String(err);

        console.error(`[extraction] Provider "${parser.name}" failed: ${errorMessage}`);

        return {
            result: null,
            attempt: {
                provider: parser.name,
                success: false,
                latency_ms,
                error: errorMessage,
            },
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractOptions {
    primary: VisionParser;
    fallback: VisionParser | null;
    imageBuffer: Buffer;
    mimeType: string;
}

/**
 * Run the full primary → fallback extraction pipeline.
 *
 * Returns an ExtractionResult with:
 *   - status: "success" | "fallback_success" | "failed"
 *   - result: the ParseResult (or null on total failure)
 *   - all attempts, for observability logging
 */
export async function extractReceipt(
    opts: ExtractOptions
): Promise<ExtractionResult> {
    const pipelineStart = Date.now();
    const attempts: ParseAttemptRecord[] = [];

    // ── Step 1: Primary provider ─────────────────────────────────────────────
    const primary = await runProviderAttempt(
        opts.primary,
        opts.imageBuffer,
        opts.mimeType
    );
    attempts.push(primary.attempt);

    if (primary.result) {
        return {
            status: "success",
            result: primary.result,
            provider_used: opts.primary.name,
            attempts,
            total_latency_ms: Date.now() - pipelineStart,
        };
    }

    // ── Step 2: Fallback provider (if available) ─────────────────────────────
    if (opts.fallback) {
        console.log(
            `[extraction] Primary failed; trying fallback provider "${opts.fallback.name}"`
        );

        const fallback = await runProviderAttempt(
            opts.fallback,
            opts.imageBuffer,
            opts.mimeType
        );
        attempts.push(fallback.attempt);

        if (fallback.result) {
            return {
                status: "fallback_success",
                result: fallback.result,
                provider_used: opts.fallback.name as ProviderName,
                attempts,
                total_latency_ms: Date.now() - pipelineStart,
            };
        }
    }

    // ── Step 3: Both providers failed ────────────────────────────────────────
    console.error("[extraction] All providers failed — returning extraction_failed");

    return {
        status: "failed",
        result: null,
        provider_used: null,
        attempts,
        total_latency_ms: Date.now() - pipelineStart,
    };
}

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Core domain types – used across the entire pipeline
// ─────────────────────────────────────────────────────────────────────────────

export const LineItemSchema = z.object({
    name: z.string().min(1),
    amount: z.number(),
});

export const ParseResultSchema = z.object({
    merchant: z.string().nullable(),
    category: z.string().nullable().optional(),
    date: z.string().nullable(), // ISO-8601 preferred, but accept raw string
    line_items: z.array(LineItemSchema),
    total: z.number().nullable(),
    confidence: z.enum(["high", "medium", "low"]),
    low_confidence_fields: z.array(z.string()).optional(),
    notes: z.string().nullable(),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;
export type Confidence = ParseResult["confidence"];

// ─────────────────────────────────────────────────────────────────────────────
// Provider types
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderName = "gemini" | "openai";

export interface ParseAttemptRecord {
    provider: ProviderName;
    success: boolean;
    latency_ms: number;
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction pipeline result
// ─────────────────────────────────────────────────────────────────────────────

export type ExtractionStatus = "success" | "fallback_success" | "failed";

export interface ExtractionResult {
    status: ExtractionStatus;
    result: ParseResult | null;
    provider_used: ProviderName | null;
    attempts: ParseAttemptRecord[];
    total_latency_ms: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database row types (the persistence layer's shape)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptRow {
    id: number;
    image_path: string;
    image_hash: string;
    raw_json: string;
    edited_json: string | null;
    provider: ProviderName | null;
    parse_latency_ms: number | null;
    parse_status: ExtractionStatus | null;
    prompt_version: string | null;
    created_at: string;
    updated_at: string | null;
}

export interface ParseAttemptRow {
    id: number;
    receipt_id: number;
    provider: ProviderName;
    success: number; // SQLite stores booleans as 0/1
    latency_ms: number;
    error: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadResponse {
    receipt_id: number;
    status: ExtractionStatus;
    result: ParseResult | null;
    provider_used: ProviderName | null;
    parse_latency_ms: number;
    from_cache: boolean;
}

export interface SaveResponse {
    receipt_id: number;
    saved: boolean;
}

export interface ReceiptDetail extends ReceiptRow {
    attempts: ParseAttemptRow[];
}

export interface ApiError {
    error: string;
    code: string;
    details?: unknown;
}

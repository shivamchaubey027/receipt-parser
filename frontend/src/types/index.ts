// ─────────────────────────────────────────────────────────────────────────────
// Shared domain types — mirrors backend types/index.ts
// In a monorepo, this would be a shared package. For this prototype, it's
// a simple copy to keep the frontend self-contained.
// ─────────────────────────────────────────────────────────────────────────────

export interface LineItem {
    name: string;
    amount: number;
}

export interface ParseResult {
    merchant: string | null;
    category: string | null;
    date: string | null;
    line_items: LineItem[];
    total: number | null;
    confidence: "high" | "medium" | "low";
    low_confidence_fields?: string[];
    notes: string | null;
}

export type Confidence = ParseResult["confidence"];
export type ProviderName = "gemini" | "openai";
export type ExtractionStatus = "success" | "fallback_success" | "failed";

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

export interface ParseAttemptRow {
    id: number;
    receipt_id: number;
    provider: ProviderName;
    success: number;
    latency_ms: number;
    error: string | null;
    created_at: string;
}

export interface ReceiptDetail {
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
    attempts: ParseAttemptRow[];
}

export interface ReceiptSummary {
    id: number;
    image_path: string;
    raw_json: string;
    edited_json: string | null;
    provider: ProviderName | null;
    parse_status: ExtractionStatus | null;
    parse_latency_ms: number | null;
    created_at: string;
}

export type AppView = "upload" | "editor" | "history";

export interface AppState {
    view: AppView;
    uploadResponse: UploadResponse | null;
    editedResult: ParseResult | null;
    receiptId: number | null;
    loading: boolean;
    error: string | null;
    saveStatus: "idle" | "saving" | "saved" | "error";
}

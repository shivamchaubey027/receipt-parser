import type { LineItem, ParseResult, Confidence } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Domain utilities — pure functions, zero side effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the sum of all line item amounts.
 * Rounds to 2 decimal places to avoid IEEE 754 drift.
 */
export function computeLineItemTotal(items: LineItem[]): number {
    const sum = items.reduce((acc, item) => acc + item.amount, 0);
    return Math.round(sum * 100) / 100;
}

/**
 * Returns true when the sum of line items does NOT match the stated total.
 * Tolerates a 1-cent rounding difference.
 */
export function hasTotalMismatch(result: ParseResult): boolean {
    if (!result || result.total == null || !Array.isArray(result.line_items) || result.line_items.length === 0) return false;
    const computed = computeLineItemTotal(result.line_items);
    return Math.abs(computed - result.total) > 0.01;
}

/**
 * Returns true when a field name is in the low_confidence_fields list.
 */
export function isLowConfidenceField(
    result: ParseResult,
    field: string
): boolean {
    return Array.isArray(result?.low_confidence_fields) ? result.low_confidence_fields.includes(field) : false;
}

/**
 * Human-readable label for a confidence level.
 */
export function confidenceLabel(confidence: Confidence): string {
    const labels: Record<Confidence, string> = {
        high: "High confidence",
        medium: "Medium confidence",
        low: "Low confidence",
    };
    return labels[confidence];
}

/**
 * Format a number as a currency string (USD by default).
 */
export function formatCurrency(amount: number, currencyCode: string | null = "USD"): string {
    const code = currencyCode?.toUpperCase() || "USD";
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: code,
        }).format(amount);
    } catch {
        // Fallback for invalid currency codes
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    }
}

/**
 * Format an ISO date string as a human-readable date.
 * Returns the raw string unchanged if it cannot be parsed.
 */
export function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
}

/**
 * Compute elapsed time in a human-readable format.
 */
export function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Deep clone a ParseResult to avoid mutating shared state.
 * Structured clone is available in all modern browsers and Node 17+.
 */
export function cloneResult(result: ParseResult): ParseResult {
    return structuredClone(result);
}

/**
 * Returns an empty ParseResult for initialising the editor in manual mode.
 */
export function emptyParseResult(): ParseResult {
    return {
        merchant: null,
        category: null,
        currency: "USD",
        date: null,
        line_items: [],
        total: null,
        confidence: "low",
        low_confidence_fields: [],
        notes: null,
    };
}

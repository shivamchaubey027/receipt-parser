import type {
    UploadResponse,
    SaveResponse,
    ReceiptDetail,
    ParseResult,
    ReceiptSummary,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Typed API client.
//
// All fetch calls live here — routes are aware of the Vite proxy so the
// base URL is just /api. Error handling is uniform across all calls.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/api";

class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let code = "UNKNOWN_ERROR";
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            code = body.code ?? code;
            message = body.error ?? message;
        } catch {
            /* response body is not JSON */
        }
        throw new ApiError(res.status, code, message);
    }
    return res.json() as Promise<T>;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadReceipt(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append("image", file);

    const res = await fetch(`${BASE}/upload`, {
        method: "POST",
        body: form,
    });

    return handleResponse<UploadResponse>(res);
}

// ── Receipts ──────────────────────────────────────────────────────────────────

export async function listReceipts(): Promise<ReceiptSummary[]> {
    const res = await fetch(`${BASE}/receipts`);
    const body = await handleResponse<{ receipts: ReceiptSummary[] }>(res);
    return body.receipts;
}

export async function getReceipt(id: number): Promise<ReceiptDetail> {
    const res = await fetch(`${BASE}/receipts/${id}`);
    return handleResponse<ReceiptDetail>(res);
}

export async function saveReceipt(
    id: number,
    data: ParseResult
): Promise<SaveResponse> {
    const res = await fetch(`${BASE}/receipts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return handleResponse<SaveResponse>(res);
}

export async function deleteReceipt(id: number): Promise<void> {
    const res = await fetch(`${BASE}/receipts/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        throw new Error(`Failed to delete receipt: ${res.statusText}`);
    }
}

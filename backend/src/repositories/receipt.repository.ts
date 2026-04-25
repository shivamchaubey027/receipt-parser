import { getDb } from "../db/connection";
import type {
    ReceiptRow,
    ParseAttemptRow,
    ParseResult,
    ProviderName,
    ExtractionStatus,
    ParseAttemptRecord,
    ReceiptDetail,
} from "../types";
import { config } from "../config";

// ─────────────────────────────────────────────────────────────────────────────
// ReceiptRepository — all SQL in one place, typed, no magic strings elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

export class ReceiptRepository {
    private db = getDb();

    // ── Queries ──────────────────────────────────────────────────────────────

    private _stmts: ReturnType<typeof this._createStmts> | undefined;

    private _createStmts() {
        return {
            findByHash: this.db.prepare<[string], ReceiptRow>(
                `SELECT * FROM receipts WHERE image_hash = ?`
            ),
            findById: this.db.prepare<[number], ReceiptRow>(
                `SELECT * FROM receipts WHERE id = ?`
            ),
            listAll: this.db.prepare<[], ReceiptRow>(
                `SELECT * FROM receipts ORDER BY created_at DESC`
            ),
            insertReceipt: this.db.prepare<
                {
                    image_path: string;
                    image_hash: string;
                    raw_json: string;
                    provider: string | null;
                    parse_latency_ms: number | null;
                    parse_status: string | null;
                    prompt_version: string;
                },
                { id: number }
            >(
                `INSERT INTO receipts
         (image_path, image_hash, raw_json, provider, parse_latency_ms, parse_status, prompt_version)
       VALUES
         (@image_path, @image_hash, @raw_json, @provider, @parse_latency_ms, @parse_status, @prompt_version)
       RETURNING id`
            ),
            updateEdited: this.db.prepare<[string, string, number], void>(
                `UPDATE receipts
       SET edited_json = ?, updated_at = ?
       WHERE id = ?`
            ),
            listAttempts: this.db.prepare<[number], ParseAttemptRow>(
                `SELECT * FROM parse_attempts WHERE receipt_id = ? ORDER BY id ASC`
            ),
            deleteReceipt: this.db.prepare<[number], void>(
                `DELETE FROM receipts WHERE id = ?`
            ),
        };
    }

    private get stmts() {
        if (!this._stmts) {
            this._stmts = this._createStmts();
        }
        return this._stmts;
    }

    // ── Writes ───────────────────────────────────────────────────────────────

    /**
     * Insert a new receipt row AND all its parse attempts atomically.
     * Returns the newly created receipt id.
     */
    save(params: {
        image_path: string;
        image_hash: string;
        result: ParseResult | null;
        provider: ProviderName | null;
        parse_latency_ms: number;
        parse_status: ExtractionStatus;
        attempts: ParseAttemptRecord[];
    }): number {
        const insertAttempt = this.db.prepare(
            `INSERT INTO parse_attempts (receipt_id, provider, success, latency_ms, error)
       VALUES (?, ?, ?, ?, ?)`
        );

        const op = this.db.transaction(() => {
            const row = this.stmts.insertReceipt.get({
                image_path: params.image_path,
                image_hash: params.image_hash,
                raw_json: JSON.stringify(params.result ?? {}),
                provider: params.provider,
                parse_latency_ms: params.parse_latency_ms,
                parse_status: params.parse_status,
                prompt_version: config.PROMPT_VERSION,
            });

            if (!row) throw new Error("INSERT INTO receipts returned no row");

            for (const attempt of params.attempts) {
                insertAttempt.run(
                    row.id,
                    attempt.provider,
                    attempt.success ? 1 : 0,
                    attempt.latency_ms,
                    attempt.error ?? null
                );
            }

            return row.id;
        });

        return op() as number;
    }

    /**
     * Persist user-corrected JSON for a receipt.
     */
    saveEdits(receiptId: number, edited: ParseResult): void {
        const now = new Date().toISOString();
        this.stmts.updateEdited.run(JSON.stringify(edited), now, receiptId);
    }

    /**
     * Delete a receipt and its cascaded attempt logs.
     */
    deleteReceipt(receiptId: number): void {
        this.stmts.deleteReceipt.run(receiptId);
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    findByHash(hash: string): ReceiptRow | undefined {
        return this.stmts.findByHash.get(hash);
    }

    findById(id: number): ReceiptRow | undefined {
        return this.stmts.findById.get(id);
    }

    listAll(): ReceiptRow[] {
        return this.stmts.listAll.all();
    }

    findDetailById(id: number): ReceiptDetail | undefined {
        const receipt = this.findById(id);
        if (!receipt) return undefined;
        const attempts = this.stmts.listAttempts.all(id);
        return { ...receipt, attempts };
    }
}

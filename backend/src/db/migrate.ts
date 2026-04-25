import { getDb } from "./connection";

// ─────────────────────────────────────────────────────────────────────────────
// Schema migrations — idempotent, run at server startup.
// Each statement is safe to run multiple times via CREATE TABLE IF NOT EXISTS.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS = [
    // ── Migration 001: Core receipts table ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS receipts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path       TEXT NOT NULL,
    image_hash       TEXT UNIQUE NOT NULL,
    raw_json         TEXT NOT NULL,
    edited_json      TEXT,
    provider         TEXT,
    parse_latency_ms INTEGER,
    parse_status     TEXT,
    prompt_version   TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME
  )`,

    // ── Migration 002: Per-attempt observability log ─────────────────────────
    `CREATE TABLE IF NOT EXISTS parse_attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id   INTEGER NOT NULL,
    provider     TEXT NOT NULL,
    success      INTEGER NOT NULL DEFAULT 0,
    latency_ms   INTEGER NOT NULL DEFAULT 0,
    error        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
  )`,

    // ── Migration 003: Index for dedup lookups ───────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_receipts_image_hash
   ON receipts(image_hash)`,

    // ── Migration 004: Index for attempt lookups ─────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_parse_attempts_receipt_id
   ON parse_attempts(receipt_id)`,
];

export function runMigrations(): void {
    const db = getDb();

    // Run all migrations atomically
    const migrate = db.transaction(() => {
        for (const sql of MIGRATIONS) {
            db.exec(sql);
        }
    });

    migrate();
    console.log("✅ Database migrations applied successfully");
}

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../config";

// ─────────────────────────────────────────────────────────────────────────────
// SQLite database singleton.
// WAL mode for concurrent read performance.
// ─────────────────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!_db) {
        const dbPath = path.resolve(config.DB_PATH);

        // Ensure the directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        _db = new Database(dbPath);

        // WAL mode: concurrent reads without blocking writes
        _db.pragma("journal_mode = WAL");
        // Enforce foreign keys at the connection level
        _db.pragma("foreign_keys = ON");
    }

    return _db;
}

export function closeDb(): void {
    if (_db) {
        _db.close();
        _db = null;
    }
}

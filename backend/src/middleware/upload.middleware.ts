import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "../config";
import { Errors } from "./error.middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Multer upload middleware.
//
// Stores files to disk (not memory) so large receipts don't OOM the server.
// File naming: {timestamp}-{random}.{ext} to avoid collisions.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_BYTES = config.MAX_UPLOAD_MB * 1024 * 1024;

// Ensure the upload directory exists
const uploadDir = path.resolve(config.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, unique);
    },
});

function fileFilter(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
): void {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(Errors.unsupportedType());
    }
}

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_BYTES },
}).single("image");

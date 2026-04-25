import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { uploadMiddleware } from "../middleware/upload.middleware";
import { Errors } from "../middleware/error.middleware";
import { normalizeImage } from "../services/image.service";
import { computeImageHash } from "../services/dedup.service";
import { extractReceipt } from "../services/extraction.service";
import { getProviders } from "../services/llm/registry";
import { ReceiptRepository } from "../repositories/receipt.repository";
import type { UploadResponse } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload
//
// Full pipeline:
//   1. validate + store image
//   2. compute hash → dedup check
//   3. normalize image
//   4. extract via primary + fallback providers
//   5. persist receipt + attempt records
//   6. return structured response
// ─────────────────────────────────────────────────────────────────────────────

const repo = new ReceiptRepository();
const { primary, fallback } = getProviders();

export const uploadRouter = Router();

uploadRouter.post(
    "/",
    (req: Request, res: Response, next: NextFunction) => {
        uploadMiddleware(req, res, (err) => {
            if (err) return next(err);
            next();
        });
    },
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.file) {
            return next(Errors.badRequest("No image file attached. Use field name: image"));
        }

        const filePath = req.file.path;

        try {
            // ── Step 1: Read raw bytes for hashing (pre-normalisation) ────────────
            const rawBuffer = fs.readFileSync(filePath);
            const imageHash = computeImageHash(rawBuffer);

            // ── Step 2: Dedup check ───────────────────────────────────────────────
            const existing = repo.findByHash(imageHash);
            if (existing) {
                // Clean up the redundant uploaded file
                fs.unlinkSync(filePath);

                const detail = repo.findDetailById(existing.id);
                const response: UploadResponse = {
                    receipt_id: existing.id,
                    status: (existing.parse_status as UploadResponse["status"]) ?? "success",
                    result: existing.raw_json ? JSON.parse(existing.raw_json) : null,
                    provider_used: existing.provider as UploadResponse["provider_used"],
                    parse_latency_ms: existing.parse_latency_ms ?? 0,
                    from_cache: true,
                };
                res.json(response);
                return;
            }

            // ── Step 3: Normalize image ───────────────────────────────────────────
            const normalized = await normalizeImage(rawBuffer);

            // ── Step 4: Extract via LLM pipeline ─────────────────────────────────
            const extraction = await extractReceipt({
                primary,
                fallback,
                imageBuffer: normalized.buffer,
                mimeType: normalized.mimeType,
            });

            // ── Step 5: Persist ───────────────────────────────────────────────────
            const relativePath = path.relative(process.cwd(), filePath);
            const receiptId = repo.save({
                image_path: relativePath,
                image_hash: imageHash,
                result: extraction.result,
                provider: extraction.provider_used,
                parse_latency_ms: extraction.total_latency_ms,
                parse_status: extraction.status,
                attempts: extraction.attempts,
            });

            // ── Step 6: Respond ───────────────────────────────────────────────────
            const response: UploadResponse = {
                receipt_id: receiptId,
                status: extraction.status,
                result: extraction.result,
                provider_used: extraction.provider_used,
                parse_latency_ms: extraction.total_latency_ms,
                from_cache: false,
            };

            res.status(201).json(response);
        } catch (err) {
            // Clean up uploaded file on any error
            try { fs.unlinkSync(filePath); } catch { /* already gone */ }
            next(err);
        }
    }
);

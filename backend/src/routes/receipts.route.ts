import { Router, type Request, type Response, type NextFunction } from "express";
import { ReceiptRepository } from "../repositories/receipt.repository";
import { ParseResultSchema } from "../types";
import { Errors } from "../middleware/error.middleware";
import type { SaveResponse } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// /api/receipts
//
// GET  /api/receipts          — list all receipts (summary)
// GET  /api/receipts/:id      — get detail for a single receipt (+ attempts)
// PUT  /api/receipts/:id      — save user-edited ParseResult for a receipt
// ─────────────────────────────────────────────────────────────────────────────

const repo = new ReceiptRepository();

export const receiptsRouter = Router();

// ── GET /api/receipts ────────────────────────────────────────────────────────

receiptsRouter.get("/", (_req: Request, res: Response) => {
    const receipts = repo.listAll();
    res.json({ receipts });
});

// ── GET /api/receipts/:id ────────────────────────────────────────────────────

receiptsRouter.get(
    "/:id",
    (req: Request, res: Response, next: NextFunction) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return next(Errors.badRequest("Receipt ID must be a number"));

        const detail = repo.findDetailById(id);
        if (!detail) return next(Errors.notFound(`Receipt #${id} not found`));

        res.json(detail);
    }
);

// ── PUT /api/receipts/:id ────────────────────────────────────────────────────

receiptsRouter.put(
    "/:id",
    (req: Request, res: Response, next: NextFunction) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return next(Errors.badRequest("Receipt ID must be a number"));

        const existing = repo.findById(id);
        if (!existing) return next(Errors.notFound(`Receipt #${id} not found`));

        // Validate the incoming edited data against the shared schema
        const parsed = ParseResultSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(
                Errors.badRequest("Invalid receipt data", parsed.error.flatten())
            );
        }

        repo.saveEdits(id, parsed.data);

        const response: SaveResponse = { receipt_id: id, saved: true };
        res.json(response);
    }
);

// ── DELETE /api/receipts/:id ─────────────────────────────────────────────────

receiptsRouter.delete(
    "/:id",
    (req: Request, res: Response, next: NextFunction) => {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return next(Errors.badRequest("Receipt ID must be a number"));

        const existing = repo.findById(id);
        if (!existing) return next(Errors.notFound(`Receipt #${id} not found`));

        repo.deleteReceipt(id);
        res.status(204).send();
    }
);

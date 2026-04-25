import type { Request, Response, NextFunction } from "express";
import type { ApiError } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Centralised error handler — attach to the bottom of the Express app.
//
// Provides a consistent ApiError shape across the entire API, and avoids
// leaking stack traces in production.
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = "AppError";
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper factories for common error cases — keeps routes terse
// ─────────────────────────────────────────────────────────────────────────────

export const Errors = {
    badRequest: (message: string, details?: unknown) =>
        new AppError(400, "BAD_REQUEST", message, details),
    notFound: (message: string) =>
        new AppError(404, "NOT_FOUND", message),
    fileTooLarge: (maxMb: number) =>
        new AppError(
            413,
            "FILE_TOO_LARGE",
            `File exceeds the ${maxMb}MB limit`
        ),
    unsupportedType: () =>
        new AppError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Only JPEG and PNG images are accepted"
        ),
    extractionFailed: () =>
        new AppError(
            422,
            "EXTRACTION_FAILED",
            "All providers failed to extract structured data from the image"
        ),
    internal: (message: string) =>
        new AppError(500, "INTERNAL_ERROR", message),
};

// ─────────────────────────────────────────────────────────────────────────────
// Express error handler middleware
// ─────────────────────────────────────────────────────────────────────────────

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof AppError) {
        const body: ApiError = {
            error: err.message,
            code: err.code,
            ...(err.details !== undefined && { details: err.details }),
        };
        res.status(err.statusCode).json(body);
        return;
    }

    // Unexpected errors — log full stack, return generic message
    console.error("[unhandled error]", err);
    const body: ApiError = {
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
    };
    res.status(500).json(body);
}

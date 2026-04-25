import express from "express";
import cors from "cors";
import morgan from "morgan";

import { config } from "./config";
import path from "path";
import { runMigrations } from "./db/migrate";
import { uploadRouter } from "./routes/upload.route";
import { receiptsRouter } from "./routes/receipts.route";
import { errorHandler } from "./middleware/error.middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Server bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
    // Apply database migrations before accepting any traffic
    runMigrations();

    const app = express();

    // ── Global middleware ─────────────────────────────────────────────────────
    app.use(
        cors({
            origin:
                config.NODE_ENV === "production"
                    ? process.env.ALLOWED_ORIGIN ?? false
                    : true,
            methods: ["GET", "POST", "PUT", "DELETE"],
        })
    );
    app.use(express.json({ limit: "1mb" }));
    app.use(morgan(config.NODE_ENV === "development" ? "dev" : "combined"));

    // ── Health check ──────────────────────────────────────────────────────────
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            provider: config.LLM_PROVIDER,
            prompt_version: config.PROMPT_VERSION,
            timestamp: new Date().toISOString(),
        });
    });

    // ── API routes ────────────────────────────────────────────────────────────
    app.use("/api/upload", uploadRouter);
    app.use("/api/receipts", receiptsRouter);

    // ── Static Frontend Serving (For Production / Docker) ────────────────────────
    if (config.NODE_ENV === "production" || process.env.RENDER) {
        const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
        app.use(express.static(frontendDist));

        // Catch-all for SPA routing, except API
        app.get("*", (req, res, next) => {
            if (req.path.startsWith("/api/")) return next();
            res.sendFile(path.join(frontendDist, "index.html"));
        });
    }

    // ── 404 catch-all ─────────────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
    });

    // ── Centralised error handler (must be last) ──────────────────────────────
    app.use(errorHandler);

    // ── Start listening ───────────────────────────────────────────────────────
    app.listen(config.PORT, () => {
        console.log(`\n🚀 Receipt Parser API running`);
        console.log(`   → http://localhost:${config.PORT}`);
        console.log(`   → Provider:        ${config.LLM_PROVIDER}`);
        console.log(`   → Prompt version:  ${config.PROMPT_VERSION}`);
        console.log(`   → DB path:         ${config.DB_PATH}`);
        console.log(`   → Upload dir:      ${config.UPLOAD_DIR}`);
        console.log(`   → Environment:     ${config.NODE_ENV}\n`);
    });
}

bootstrap().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});

import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ─────────────────────────────────────────────────────────────────────────────
// Strongly-typed environment config with runtime validation.
// If any required variable is missing the process exits at startup, not at
// runtime when the first request hits — fail fast, fail loudly.
// ─────────────────────────────────────────────────────────────────────────────

const EnvSchema = z.object({
    LLM_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    PORT: z.coerce.number().default(3001),
    UPLOAD_DIR: z.string().default("./uploads"),
    DB_PATH: z.string().default("./receipts.db"),
    PROMPT_VERSION: z.string().default("v1"),
    MAX_UPLOAD_MB: z.coerce.number().default(10),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;

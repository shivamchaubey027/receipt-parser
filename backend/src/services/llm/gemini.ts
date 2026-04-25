import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParseResultSchema, type ParseResult } from "../../types";
import { config } from "../../config";
import type { VisionParser } from "./provider";
import { RECEIPT_PROMPT } from "./provider";

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Flash adapter.
// Uses the multimodal inlineData approach for passing image bytes directly.
// Model: gemini-1.5-flash (fast + cheap, ideal as primary provider).
// ─────────────────────────────────────────────────────────────────────────────

export class GeminiParser implements VisionParser {
    readonly name = "gemini" as const;

    private client: GoogleGenerativeAI;
    private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    constructor() {
        if (!config.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment");
        }
        this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        this.model = this.client.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                // Force pure JSON output — no markdown, no explanation
                responseMimeType: "application/json",
                temperature: 0.1, // low temperature → more deterministic
                maxOutputTokens: 1024,
            },
        });
    }

    async parseReceipt(imageBuffer: Buffer, mimeType: string): Promise<ParseResult> {
        const imagePart = {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType,
            },
        };

        const response = await this.model.generateContent([
            RECEIPT_PROMPT,
            imagePart,
        ]);

        const text = response.response.text().trim();
        const json = JSON.parse(text);
        return ParseResultSchema.parse(json);
    }
}

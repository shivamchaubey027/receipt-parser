import { ParseResultSchema, type ParseResult } from "../../types";
import { config } from "../../config";
import type { VisionParser } from "./provider";
import { RECEIPT_PROMPT } from "./provider";

export class OpenAIParser implements VisionParser {
    readonly name = "openai" as const;

    constructor() {
        if (!config.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set in environment");
        }
    }

    async parseReceipt(imageBuffer: Buffer, mimeType: string): Promise<ParseResult> {
        const base64Image = imageBuffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // fast, cheap, highly reliable JSON parsing
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: RECEIPT_PROMPT,
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Parse this receipt." },
                            {
                                type: "image_url",
                                image_url: { url: dataUrl },
                            },
                        ],
                    },
                ],
                temperature: 0.1,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI API error: ${res.status} ${err}`);
        }

        const data = await res.json();
        const content = data.choices[0].message.content;
        return ParseResultSchema.parse(JSON.parse(content));
    }
}

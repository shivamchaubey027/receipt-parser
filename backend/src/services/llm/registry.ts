import type { VisionParser, } from "./provider";
import { GeminiParser } from "./gemini";
import { OpenAIParser } from "./openai";
import type { ProviderName } from "../../types";
import { config } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Provider registry — build once at startup, reuse across requests.
// New adapters are registered here; no other code changes required.
// ─────────────────────────────────────────────────────────────────────────────

type ProviderRegistry = Record<ProviderName, () => VisionParser>;

const registry: Partial<ProviderRegistry> = {};

function registerParser(factory: () => VisionParser): void {
    try {
        const instance = factory();
        registry[instance.name] = factory;
    } catch {
        // Parser will be unavailable if its API key is missing
    }
}

registerParser(() => new GeminiParser());
registerParser(() => new OpenAIParser());

// ─────────────────────────────────────────────────────────────────────────────
// Public API — returns (primary, fallback) pair based on configuration.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_ORDER: Record<ProviderName, ProviderName> = {
    gemini: "openai",
    openai: "gemini",
};

export interface ProviderPair {
    primary: VisionParser;
    fallback: VisionParser | null;
}

export function getProviders(): ProviderPair {
    const primaryName = config.LLM_PROVIDER as ProviderName;
    const fallbackName = FALLBACK_ORDER[primaryName];

    const primaryFactory = registry[primaryName];
    if (!primaryFactory) {
        throw new Error(
            `Primary provider "${primaryName}" is not available. Set the required API key.`
        );
    }

    const fallbackFactory = registry[fallbackName];

    return {
        primary: primaryFactory(),
        fallback: fallbackFactory ? fallbackFactory() : null,
    };
}

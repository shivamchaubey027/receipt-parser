import type { Confidence } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Component: ConfidenceBadge
//
// Renders confidence level as a pill badge with semantic colour coding.
// Included wherever confidence needs to be communicated.
// ─────────────────────────────────────────────────────────────────────────────

export function createConfidenceBadge(confidence: Confidence): HTMLElement {
    const badge = document.createElement("span");
    badge.className = `confidence-badge confidence-badge--${confidence}`;
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-label", `Confidence: ${confidence}`);

    const icons: Record<Confidence, string> = {
        high: "✓",
        medium: "⚠",
        low: "✕",
    };

    const labels: Record<Confidence, string> = {
        high: "High confidence",
        medium: "Medium confidence",
        low: "Low confidence",
    };

    badge.innerHTML = `
    <span class="confidence-badge__icon" aria-hidden="true">${icons[confidence]}</span>
    <span class="confidence-badge__label">${labels[confidence]}</span>
  `;

    return badge;
}

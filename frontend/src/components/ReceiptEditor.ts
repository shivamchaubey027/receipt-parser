import type { ParseResult, UploadResponse } from "../types";
import { createConfidenceBadge } from "./ConfidenceBadge";
import { createLineItemEditor } from "./LineItemEditor";
import {
  computeLineItemTotal,
  hasTotalMismatch,
  isLowConfidenceField,
  formatCurrency,
  formatLatency,
  cloneResult,
  emptyParseResult,
} from "../utils/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Component: ReceiptEditor
//
// The central correction UI.
//
// Responsibilities:
//   - Display extraction results with confidence-aware highlighting
//   - Allow inline editing of all extracted fields (merchant, date, total, items)
//   - Surface mismatches between stated total and computed line item sum
//   - Show a global low-confidence warning banner when needed
//   - Emit onSave with the current edited state
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptEditorCallbacks {
  onSave: (result: ParseResult) => void;
  onBack: () => void;
}

export function createReceiptEditor(
  uploadResponse: UploadResponse,
  callbacks: ReceiptEditorCallbacks
): HTMLElement {
  // Use extraction result or start fresh for manual entry
  let state: ParseResult = uploadResponse.result
    ? cloneResult(uploadResponse.result)
    : emptyParseResult();

  const root = document.createElement("div");
  root.className = "editor";
  root.id = "receipt-editor";

  function render(): void {
    const mismatch = hasTotalMismatch(state);
    const computedTotal = computeLineItemTotal(state.line_items);
    const isExtractionFailed = uploadResponse.status === "failed";

    root.innerHTML = `
      ${isExtractionFailed ? renderFailedBanner() : ""}
      ${state.confidence === "low" && !isExtractionFailed ? renderLowConfidenceBanner() : ""}
      ${mismatch ? renderMismatchBanner(computedTotal) : ""}

      <div class="editor__header">
        <button type="button" class="editor__back" id="editor-back" aria-label="Back to upload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
        <div class="editor__meta">
          <span id="confidence-badge-slot"></span>
          <span class="editor__provider">via ${uploadResponse.provider_used ?? "manual"} · ${formatLatency(uploadResponse.parse_latency_ms)}</span>
          ${uploadResponse.from_cache ? `<span class="editor__cache-tag">cached</span>` : ""}
        </div>
      </div>

      <form class="editor__form" id="editor-form" novalidate>
        <fieldset class="editor__fieldset">
          <legend class="editor__legend">Receipt Details</legend>

          <div class="editor__field ${isLowConfidenceField(state, "merchant") ? "editor__field--uncertain" : ""}">
            <label for="field-merchant" class="editor__label">
              Merchant
              ${isLowConfidenceField(state, "merchant") ? `<span class="editor__uncertain-tag">uncertain</span>` : ""}
            </label>
            <input
              type="text"
              id="field-merchant"
              class="editor__input"
              value="${escapeHtml(state.merchant ?? "")}"
              placeholder="Store name"
              autocomplete="organization"
            />
          </div>

          <div class="editor__field ${isLowConfidenceField(state, "date") ? "editor__field--uncertain" : ""}">
            <label for="field-date" class="editor__label">
              Date
              ${isLowConfidenceField(state, "date") ? `<span class="editor__uncertain-tag">uncertain</span>` : ""}
            </label>
            <input
              type="date"
              id="field-date"
              class="editor__input"
              value="${state.date ?? ""}"
            />
          </div>
        </fieldset>

        <fieldset class="editor__fieldset">
          <legend class="editor__legend">Line Items</legend>
          <div id="line-item-editor-slot"></div>
        </fieldset>

        <fieldset class="editor__fieldset">
          <legend class="editor__legend">Totals</legend>

          <div class="editor__totals">
            <div class="editor__totals-row">
              <span>Computed from items</span>
              <span class="editor__totals-computed">${formatCurrency(computedTotal, state.currency)}</span>
            </div>
            <div class="editor__field editor__field--total ${isLowConfidenceField(state, "total") ? "editor__field--uncertain" : ""}">
              <label for="field-total" class="editor__label">
                Receipt total
                ${isLowConfidenceField(state, "total") ? `<span class="editor__uncertain-tag">uncertain</span>` : ""}
              </label>
              <input
                type="number"
                id="field-total"
                class="editor__input editor__input--total ${mismatch ? "editor__input--mismatch" : ""}"
                value="${state.total ?? ""}"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>
        </fieldset>

        ${state.notes ? `
        <fieldset class="editor__fieldset">
          <legend class="editor__legend">Extraction Notes</legend>
          <p class="editor__notes">${escapeHtml(state.notes)}</p>
        </fieldset>
        ` : ""}

        <div class="editor__actions">
          <button type="submit" class="btn btn--primary" id="save-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Save receipt
          </button>
        </div>
      </form>
    `;

    // Mount the confidence badge
    const badgeSlot = root.querySelector("#confidence-badge-slot")!;
    badgeSlot.appendChild(createConfidenceBadge(state.confidence));

    // Mount the line item editor
    const lineItemSlot = root.querySelector("#line-item-editor-slot")!;
    lineItemSlot.appendChild(
      createLineItemEditor(state.line_items, {
        onChange: (items) => {
          state.line_items = items;
          // Re-render only the totals section to avoid full re-render
          const computedEl = root.querySelector(".editor__totals-computed");
          const totalInput = root.querySelector<HTMLInputElement>("#field-total");
          const newComputed = computeLineItemTotal(items);
          if (computedEl) computedEl.textContent = formatCurrency(newComputed, state.currency);
          if (totalInput) {
            const isMismatch =
              state.total !== null &&
              Math.abs(newComputed - state.total) > 0.01;
            totalInput.classList.toggle("editor__input--mismatch", isMismatch);
          }
          // Update mismatch banner
          updateMismatchBanner(newComputed);
        },
      })
    );

    attachFormListeners();
  }

  function attachFormListeners(): void {
    // Back button
    root.querySelector("#editor-back")?.addEventListener("click", callbacks.onBack);

    // Merchant
    root.querySelector<HTMLInputElement>("#field-merchant")?.addEventListener(
      "change",
      (e) => {
        state.merchant = (e.target as HTMLInputElement).value.trim() || null;
      }
    );

    // Date
    root.querySelector<HTMLInputElement>("#field-date")?.addEventListener(
      "change",
      (e) => {
        state.date = (e.target as HTMLInputElement).value || null;
      }
    );

    // Total
    root.querySelector<HTMLInputElement>("#field-total")?.addEventListener(
      "change",
      (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        state.total = isNaN(val) ? null : val;
        const computed = computeLineItemTotal(state.line_items);
        updateMismatchBanner(computed);
      }
    );

    // Form submit
    root.querySelector<HTMLFormElement>("#editor-form")?.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        callbacks.onSave({ ...state });
      }
    );
  }

  function updateMismatchBanner(computed: number): void {
    const existing = root.querySelector(".banner--mismatch");
    const isMismatch =
      state.total !== null && Math.abs(computed - state.total) > 0.01;

    if (isMismatch && !existing) {
      const form = root.querySelector(".editor__form");
      const banner = document.createElement("div");
      banner.innerHTML = renderMismatchBanner(computed);
      form?.prepend(banner.firstElementChild!);
    } else if (!isMismatch && existing) {
      existing.remove();
    }
  }

  function renderFailedBanner(): string {
    return `
      <div class="banner banner--error" role="alert">
        <strong>Extraction failed.</strong>
        All providers were unable to parse this receipt.
        You can enter the details manually below.
      </div>
    `;
  }

  function renderLowConfidenceBanner(): string {
    return `
      <div class="banner banner--warning" role="alert">
        <strong>Low confidence extraction.</strong>
        The model had difficulty reading this receipt.
        Please review all fields carefully before saving.
      </div>
    `;
  }

  function renderMismatchBanner(computed: number): string {
    return `
      <div class="banner banner--mismatch" role="alert">
        <strong>Total mismatch detected.</strong>
        Line items sum to <strong>${formatCurrency(computed, state.currency)}</strong>
        but receipt total is <strong>${formatCurrency(state.total ?? 0, state.currency)}</strong>.
        Please verify.
      </div>
    `;
  }

  render();
  return root;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

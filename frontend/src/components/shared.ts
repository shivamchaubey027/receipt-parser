import type { ReceiptSummary } from "../types";
import { formatCurrency, formatDate } from "../utils/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Component: HistoryPanel
//
// Displays a list of all past receipts fetched from the API.
// Each row is clickable to load the editor for that receipt.
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryPanelCallbacks {
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export function createHistoryPanel(
  receipts: ReceiptSummary[],
  callbacks: HistoryPanelCallbacks
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "history-panel";
  panel.id = "history-panel";

  if (receipts.length === 0) {
    panel.innerHTML = `
      <div class="history-panel__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <p>No receipts yet. Upload your first one!</p>
      </div>
    `;
    return panel;
  }

  const currencyTotals: Record<string, number> = {};
  const categoryTotals: Record<string, Record<string, number>> = {};

  receipts.forEach(r => {
    if (!r.edited_json && !r.raw_json) return;
    try {
      const data = JSON.parse(r.edited_json || r.raw_json);
      const total = typeof data.total === "number" ? data.total : 0;
      const category = data.category || "Uncategorized";
      const currency = data.currency || "USD";

      currencyTotals[currency] = (currencyTotals[currency] || 0) + total;

      if (!categoryTotals[currency]) categoryTotals[currency] = {};
      categoryTotals[currency][category] = (categoryTotals[currency][category] || 0) + total;
    } catch { }
  });

  const totalTitles = Object.entries(currencyTotals)
    .map(([curr, amt]) => formatCurrency(amt, curr))
    .join(" + ");

  const categoryHtml = Object.entries(categoryTotals)
    .flatMap(([curr, categories]) => {
      return Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `<span class="report-tag">${cat}: ${formatCurrency(amt, curr)}</span>`);
    })
    .join("");

  panel.innerHTML = `
    <div class="report-summary">
      <h2 class="report-summary__title">Total Spend: ${totalTitles || "$0.00"}</h2>
      <div class="report-summary__categories">${categoryHtml}</div>
    </div>
    <ul class="history-panel__list" role="list" aria-label="Receipt history">
      ${receipts.map((r) => renderReceiptCard(r)).join("")}
    </ul>
  `;

  // Attach click handlers
  panel.querySelectorAll<HTMLElement>("[data-receipt-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // Ignore click if clicking delete button
      if ((e.target as HTMLElement).closest(".history-card__delete")) return;
      const id = parseInt(el.dataset.receiptId!, 10);
      callbacks.onSelect(id);
    });
    el.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).closest(".history-card__delete")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = parseInt(el.dataset.receiptId!, 10);
        callbacks.onSelect(id);
      }
    });
  });

  panel.querySelectorAll<HTMLButtonElement>(".history-card__delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.deleteId!, 10);
      callbacks.onDelete(id);
    });
  });

  return panel;
}

function renderReceiptCard(receipt: ReceiptSummary): string {
  const statusClass = receipt.parse_status ?? "success";
  const statusLabel: Record<string, string> = {
    success: "Success",
    fallback_success: "Fallback",
    failed: "Failed",
  };

  let merchant = "Unknown Merchant";
  let formattedTotal = "—";
  let category = "Uncategorized";

  try {
    if (receipt.edited_json || receipt.raw_json) {
      const data = JSON.parse(receipt.edited_json || receipt.raw_json);
      if (data.merchant) merchant = data.merchant;
      if (typeof data.total === "number") formattedTotal = formatCurrency(data.total, data.currency);
      if (data.category) category = data.category;
    }
  } catch { }

  return `
    <li
      class="history-card"
      data-receipt-id="${receipt.id}"
      role="button"
      tabindex="0"
      aria-label="Receipt from ${merchant}"
    >
      <div class="history-card__header">
        <div class="history-card__status history-card__status--${statusClass}">
          ${statusLabel[statusClass] ?? "Unknown"}
        </div>
        <div class="history-card__header-right">
          <span class="history-card__category">${category}</span>
          <button class="history-card__delete" data-delete-id="${receipt.id}" aria-label="Delete receipt" title="Delete receipt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6m5 0V4h4v2"></path>
              </svg>
          </button>
        </div>
      </div>
      <div class="history-card__body">
        <span class="history-card__id">${merchant}</span>
        <span class="history-card__total">${formattedTotal}</span>
      </div>
      <div class="history-card__footer">
        <span class="history-card__date">${formatDate(receipt.created_at)}</span>
        <span class="history-card__provider">${receipt.provider ?? "—"}</span>
      </div>
    </li>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: ToastNotification
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: ToastType = "info"): void {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation frame to allow CSS transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("toast--visible"));
  });

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: LoadingOverlay
// ─────────────────────────────────────────────────────────────────────────────

export function createLoadingSpinner(label = "Loading…"): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "loading-spinner";
  wrapper.setAttribute("role", "status");
  wrapper.setAttribute("aria-label", label);
  wrapper.innerHTML = `
    <svg class="loading-spinner__svg" viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
    </svg>
    <span class="loading-spinner__label">${label}</span>
  `;
  return wrapper;
}

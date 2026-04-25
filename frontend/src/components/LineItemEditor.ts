import type { LineItem } from "../types";
import { formatCurrency } from "../utils/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Component: LineItemEditor
//
// Renders a list of line items with inline editing.
// Emits onChange whenever items change so the parent can recompute totals.
// ─────────────────────────────────────────────────────────────────────────────

export interface LineItemEditorCallbacks {
    onChange: (items: LineItem[]) => void;
}

export function createLineItemEditor(
    items: LineItem[],
    callbacks: LineItemEditorCallbacks
): HTMLElement {
    // Local mutable copy — changes are emitted via callbacks.onChange
    let state: LineItem[] = items.map((i) => ({ ...i }));

    const container = document.createElement("div");
    container.className = "line-item-editor";

    function render(): void {
        container.innerHTML = `
      <div class="line-item-editor__header">
        <span class="line-item-editor__col-name">Item</span>
        <span class="line-item-editor__col-amount">Amount</span>
        <span class="line-item-editor__col-actions" aria-label="Actions"></span>
      </div>
      <ul class="line-item-editor__list" id="line-items-list" aria-label="Line items">
        ${state.map((item, idx) => renderRow(item, idx)).join("")}
      </ul>
      <button
        type="button"
        class="line-item-editor__add"
        id="add-line-item"
        aria-label="Add line item"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add item
      </button>
    `;

        attachListeners();
    }

    function renderRow(item: LineItem, idx: number): string {
        return `
      <li class="line-item-editor__row" data-idx="${idx}">
        <input
          type="text"
          class="line-item-editor__name-input"
          value="${escapeHtml(item.name)}"
          placeholder="Item description"
          aria-label="Item name"
          data-idx="${idx}"
          data-field="name"
        />
        <input
          type="number"
          class="line-item-editor__amount-input"
          value="${item.amount}"
          step="0.01"
          min="0"
          placeholder="0.00"
          aria-label="Item amount"
          data-idx="${idx}"
          data-field="amount"
        />
        <button
          type="button"
          class="line-item-editor__remove"
          data-idx="${idx}"
          aria-label="Remove item ${escapeHtml(item.name)}"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </li>
    `;
    }

    function attachListeners(): void {
        // Input changes
        container.querySelectorAll<HTMLInputElement>(
            "[data-idx][data-field]"
        ).forEach((input) => {
            input.addEventListener("change", () => {
                const idx = parseInt(input.dataset.idx!, 10);
                const field = input.dataset.field as "name" | "amount";
                if (field === "name") {
                    state[idx].name = input.value;
                } else {
                    state[idx].amount = parseFloat(input.value) || 0;
                }
                callbacks.onChange([...state]);
            });
        });

        // Remove buttons
        container.querySelectorAll<HTMLButtonElement>(
            ".line-item-editor__remove"
        ).forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.idx!, 10);
                state.splice(idx, 1);
                callbacks.onChange([...state]);
                render();
            });
        });

        // Add item button
        const addBtn = container.querySelector<HTMLButtonElement>("#add-line-item")!;
        addBtn.addEventListener("click", () => {
            state.push({ name: "", amount: 0 });
            callbacks.onChange([...state]);
            render();
            // Focus the newly added name input
            const rows = container.querySelectorAll<HTMLInputElement>(
                ".line-item-editor__name-input"
            );
            rows[rows.length - 1]?.focus();
        });
    }

    render();
    return container;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Render a read-only, formatted line items table (for history view).
 */
export function createLineItemTable(items: LineItem[]): HTMLElement {
    const table = document.createElement("table");
    table.className = "line-item-table";
    table.innerHTML = `
    <thead>
      <tr>
        <th>Item</th>
        <th class="line-item-table__amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items
            .map(
                (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="line-item-table__amount">${formatCurrency(item.amount)}</td>
        </tr>
      `
            )
            .join("")}
    </tbody>
  `;
    return table;
}

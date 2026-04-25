/// <reference types="vite/client" />
import type { AppState, ParseResult, UploadResponse } from "./types";
import { uploadReceipt, saveReceipt, listReceipts, getReceipt } from "./api/client";
import {
    createUploadZone,
    setUploadZoneLoading,
    resetUploadZone,
} from "./components/UploadZone";
import { createReceiptEditor } from "./components/ReceiptEditor";
import {
    createHistoryPanel,
    showToast,
    createLoadingSpinner,
} from "./components/shared";
import { cloneResult } from "./utils/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Application controller — manages state, view transitions, and API calls.
//
// Architecture decisions:
//   - No framework. State is a plain object, views are DOM components.
//   - All rendering is done by individual component factories that return
//     HTMLElement. The app controller mounts / unmounts them from #app.
//   - State transitions are explicit, logged in development.
// ─────────────────────────────────────────────────────────────────────────────

class App {
    private state: AppState = {
        view: "upload",
        uploadResponse: null,
        editedResult: null,
        receiptId: null,
        loading: false,
        error: null,
        saveStatus: "idle",
    };

    private appRoot: HTMLElement;
    private nav: HTMLElement;

    constructor() {
        this.appRoot = document.getElementById("app")!;
        this.nav = document.getElementById("main-nav")!;
        this.setupNavigation();
        this.render();
    }

    // ── State management ────────────────────────────────────────────────────────

    private setState(patch: Partial<AppState>): void {
        const prev = this.state;
        this.state = { ...this.state, ...patch };
        if (import.meta.env.DEV) {
            console.debug("[state]", { prev, next: this.state });
        }
        this.render();
    }

    // ── Navigation ──────────────────────────────────────────────────────────────

    private setupNavigation(): void {
        this.nav.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const view = btn.dataset.view as AppState["view"];
                this.navigateTo(view);
            });
        });
    }

    private navigateTo(view: AppState["view"]): void {
        this.setState({ view, error: null });
        // Update nav active state
        this.nav.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
            btn.classList.toggle("nav__item--active", btn.dataset.view === view);
        });
    }

    // ── Upload flow ─────────────────────────────────────────────────────────────

    private async handleFileSelected(file: File): Promise<void> {
        this.setState({ loading: true, error: null });

        // Get the upload zone element (it exists because view === "upload")
        const zone = this.appRoot.querySelector<HTMLElement>(".upload-zone");

        if (zone) setUploadZoneLoading(zone, file.name);

        try {
            const response = await uploadReceipt(file);
            this.setState({
                loading: false,
                view: "editor",
                uploadResponse: response,
                editedResult: response.result ? cloneResult(response.result) : null,
                receiptId: response.receipt_id,
                saveStatus: "idle",
            });

            if (response.from_cache) {
                showToast("Duplicate image detected — showing cached extraction.", "info");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed";
            if (zone) resetUploadZone(zone);
            this.setState({ loading: false, error: message });
            showToast(message, "error");
        }
    }

    // ── Save flow ───────────────────────────────────────────────────────────────

    private async handleSave(result: ParseResult): Promise<void> {
        if (!this.state.receiptId) return;

        this.setState({ saveStatus: "saving" });

        try {
            await saveReceipt(this.state.receiptId, result);
            this.setState({ saveStatus: "saved", editedResult: result });
            showToast("Receipt saved successfully.", "success");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Save failed";
            this.setState({ saveStatus: "error" });
            showToast(message, "error");
        }
    }

    // ── History view ────────────────────────────────────────────────────────────

    private async loadHistory(): Promise<void> {
        const slot = this.appRoot.querySelector("#history-slot");
        if (!slot) return;

        slot.innerHTML = "";
        slot.appendChild(createLoadingSpinner("Loading receipts…"));

        try {
            const receipts = await listReceipts();
            slot.innerHTML = "";
            slot.appendChild(
                createHistoryPanel(receipts, {
                    onSelect: (id) => this.loadReceiptForEditing(id),
                    onDelete: (id) => this.deleteReceiptFromHistory(id),
                })
            );
        } catch (err) {
            slot.innerHTML = "";
            const message = err instanceof Error ? err.message : "Failed to load history";
            const p = document.createElement("p");
            p.className = "view__error";
            p.textContent = message;
            slot.appendChild(p);
        }
    }

    private async deleteReceiptFromHistory(id: number): Promise<void> {
        // Optimistic UI or a spinner inside the panel could be implemented,
        // but for now we'll just block, delete, and reload history.
        if (!confirm("Are you sure you want to delete this receipt? This cannot be undone.")) return;

        try {
            // Wait, we need to import deleteReceipt from api/client!
            const { deleteReceipt } = await import("./api/client");
            await deleteReceipt(id);
            showToast("Receipt deleted", "success");
            this.loadHistory(); // reload the panel
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete receipt";
            showToast(message, "error");
        }
    }

    private async loadReceiptForEditing(id: number): Promise<void> {
        this.setState({ loading: true });
        try {
            const detail = await getReceipt(id);
            const rawResult = detail.raw_json ? JSON.parse(detail.raw_json) as ParseResult : null;
            const editedResult = detail.edited_json
                ? JSON.parse(detail.edited_json) as ParseResult
                : rawResult;

            const uploadResponse: UploadResponse = {
                receipt_id: detail.id,
                status: detail.parse_status ?? "success",
                result: editedResult,
                provider_used: detail.provider,
                parse_latency_ms: detail.parse_latency_ms ?? 0,
                from_cache: false,
            };

            this.setState({
                view: "editor",
                uploadResponse,
                editedResult,
                receiptId: detail.id,
                loading: false,
                saveStatus: "idle",
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load receipt";
            this.setState({ loading: false, error: message });
        }
    }

    // ── Rendering ───────────────────────────────────────────────────────────────

    private render(): void {
        this.appRoot.innerHTML = "";

        switch (this.state.view) {
            case "upload":
                this.renderUploadView();
                break;
            case "editor":
                this.renderEditorView();
                break;
            case "history":
                this.renderHistoryView();
                break;
        }
    }

    private renderUploadView(): void {
        const wrapper = document.createElement("div");
        wrapper.className = "view view--upload";

        const heading = document.createElement("h1");
        heading.className = "view__title";
        heading.textContent = "Parse a Receipt";

        const subtext = document.createElement("p");
        subtext.className = "view__subtitle";
        subtext.textContent =
            "Upload a JPEG or PNG receipt image. Our AI will extract the structured data in seconds.";

        const zone = createUploadZone({
            onFile: (file) => this.handleFileSelected(file),
            onError: (msg) => showToast(msg, "error"),
        });

        wrapper.appendChild(heading);
        wrapper.appendChild(subtext);
        wrapper.appendChild(zone);

        if (this.state.error) {
            const errorEl = document.createElement("p");
            errorEl.className = "view__error";
            errorEl.setAttribute("role", "alert");
            errorEl.textContent = this.state.error;
            wrapper.appendChild(errorEl);
        }

        this.appRoot.appendChild(wrapper);
    }

    private renderEditorView(): void {
        if (!this.state.uploadResponse) {
            this.navigateTo("upload");
            return;
        }

        const editor = createReceiptEditor(this.state.uploadResponse, {
            onSave: (result) => this.handleSave(result),
            onBack: () => this.navigateTo("upload"),
        });

        // Overlay save status indicator
        if (this.state.saveStatus === "saving") {
            const overlay = document.createElement("div");
            overlay.className = "editor__save-overlay";
            overlay.textContent = "Saving…";
            editor.appendChild(overlay);
        }

        this.appRoot.appendChild(editor);
    }

    private renderHistoryView(): void {
        const wrapper = document.createElement("div");
        wrapper.className = "view view--history";

        const heading = document.createElement("h1");
        heading.className = "view__title";
        heading.textContent = "Receipt History";

        wrapper.appendChild(heading);

        const slot = document.createElement("div");
        slot.id = "history-slot";
        wrapper.appendChild(slot);

        this.appRoot.appendChild(wrapper);

        // Load async — populates the slot after render
        this.loadHistory();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    new App();
});

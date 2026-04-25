// ─────────────────────────────────────────────────────────────────────────────
// Component: UploadZone
//
// Handles drag-and-drop and click-to-browse file selection.
// Validates MIME type and size client-side before hitting the API.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export interface UploadZoneCallbacks {
    onFile: (file: File) => void;
    onError: (message: string) => void;
}

export function createUploadZone(callbacks: UploadZoneCallbacks): HTMLElement {
    const zone = document.createElement("div");
    zone.className = "upload-zone";
    zone.id = "upload-zone";
    zone.setAttribute("role", "button");
    zone.setAttribute("tabindex", "0");
    zone.setAttribute("aria-label", "Upload receipt image");

    zone.innerHTML = `
    <div class="upload-zone__icon" aria-hidden="true">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
    <p class="upload-zone__primary">Drop a receipt image here</p>
    <p class="upload-zone__secondary">or <span class="upload-zone__link">browse files</span></p>
    <p class="upload-zone__hint">JPEG · PNG · up to ${MAX_MB}MB</p>
    <input
      type="file"
      id="file-input"
      class="upload-zone__input"
      accept="image/jpeg,image/png"
      aria-hidden="true"
      tabindex="-1"
    />
  `;

    const input = zone.querySelector<HTMLInputElement>("#file-input")!;

    function validateAndEmit(file: File): void {
        if (!ALLOWED_TYPES.has(file.type)) {
            callbacks.onError("Only JPEG and PNG images are supported.");
            return;
        }
        if (file.size > MAX_BYTES) {
            callbacks.onError(`File is too large. Maximum size is ${MAX_MB}MB.`);
            return;
        }
        callbacks.onFile(file);
    }

    // ── Click / keyboard trigger ──────────────────────────────────────────────
    zone.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".upload-zone__input")) return;
        input.click();
    });
    zone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.click();
        }
    });

    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (file) validateAndEmit(file);
        input.value = ""; // reset so the same file can be re-uploaded
    });

    // ── Drag and drop ─────────────────────────────────────────────────────────
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("upload-zone--drag");
    });

    zone.addEventListener("dragleave", (e) => {
        if (!zone.contains(e.relatedTarget as Node)) {
            zone.classList.remove("upload-zone--drag");
        }
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("upload-zone--drag");
        const file = e.dataTransfer?.files[0];
        if (file) validateAndEmit(file);
    });

    return zone;
}

/** Replace the upload zone with a loading state while parsing. */
export function setUploadZoneLoading(zone: HTMLElement, filename: string): void {
    zone.classList.add("upload-zone--loading");
    const primary = zone.querySelector(".upload-zone__primary");
    const secondary = zone.querySelector(".upload-zone__secondary");
    if (primary) primary.textContent = `Parsing "${filename}"…`;
    if (secondary) secondary.textContent = "This usually takes a few seconds.";
}

/** Reset the upload zone after parsing completes or fails. */
export function resetUploadZone(zone: HTMLElement): void {
    zone.classList.remove("upload-zone--loading", "upload-zone--drag");
    const primary = zone.querySelector(".upload-zone__primary");
    const secondary = zone.querySelector(".upload-zone__secondary");
    if (primary) primary.textContent = "Drop a receipt image here";
    if (secondary) secondary.innerHTML =
        `or <span class="upload-zone__link">browse files</span>`;
}

import sharp from "sharp";

// ─────────────────────────────────────────────────────────────────────────────
// Image normalization service.
//
// Pre-processing goals:
//   1. Auto-rotate (fix EXIF orientation from phone cameras)
//   2. Resize to a consistent max width for token efficiency
//   3. Normalize colour space (sRGB, 8bpc)
//   4. Output JPEG at 90% quality — good fidelity, lower bytes
//
// The normalised buffer is what gets sent to the LLM provider.
// The original file is stored on disk; normalising only happens in-memory.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WIDTH = 2000; // pixels — matches RFC spec
const JPEG_QUALITY = 90;
const OUTPUT_MIME = "image/jpeg" as const;

export interface NormalizationResult {
    buffer: Buffer;
    mimeType: typeof OUTPUT_MIME;
    originalWidth: number;
    originalHeight: number;
    normalizedWidth: number;
    normalizedHeight: number;
}

export async function normalizeImage(
    inputBuffer: Buffer
): Promise<NormalizationResult> {
    const pipeline = sharp(inputBuffer).rotate(); // auto-rotate from EXIF

    const metadata = await pipeline.metadata();

    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    // Only resize if the image exceeds the max width
    const shouldResize = originalWidth > MAX_WIDTH;

    const processed = shouldResize
        ? pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : pipeline;

    const outputBuffer = await processed
        .toColorspace("srgb")
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: outputBuffer.data,
        mimeType: OUTPUT_MIME,
        originalWidth,
        originalHeight,
        normalizedWidth: outputBuffer.info.width,
        normalizedHeight: outputBuffer.info.height,
    };
}

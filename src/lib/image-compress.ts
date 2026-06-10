/**
 * Client-side image compression before upload.
 *
 * Defaults: scale longest edge to 1600px, encode as image/webp at quality 0.82,
 * strip EXIF (canvas re-encode does this for free). Falls through unchanged for
 * non-images, animated GIFs, SVG, and HEIC (browser can't decode HEIC without
 * a polyfill). If the compressed output is somehow larger than the original,
 * returns the original.
 */

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  /** Output mime. Defaults to image/webp. */
  mimeType?: "image/webp" | "image/jpeg";
}

const PASSTHROUGH = new Set([
  "image/gif", // could be animated
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (PASSTHROUGH.has(file.type)) return file;
  if (typeof window === "undefined") return file;

  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  const mimeType = opts.mimeType ?? "image/webp";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported decode
  }

  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  let blob: Blob | null = null;
  // Prefer OffscreenCanvas where available.
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type: mimeType, quality });
    } catch {
      blob = null;
    }
  }
  if (!blob) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mimeType, quality),
    );
  }
  bitmap.close?.();

  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^./\\]+$/, "") || "image";
  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

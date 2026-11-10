export const DOCUMENT_EXTENSIONS = ["pdf", "docx", "pptx", "jpg", "jpeg", "png"];
export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

export function uploadError(file: { name: string; size: number }, maximum: number): string | null {
  if (!file.size) return "El archivo está vacío. Selecciona otro documento.";
  if (file.size > maximum) return `El archivo supera el límite de ${Math.round(maximum / 1024 / 1024)} MiB.`;
  if (!DOCUMENT_EXTENSIONS.includes(file.name.split(".").at(-1)?.toLowerCase() ?? "")) return "Formato no soportado. Usa PDF, DOCX, PPTX, JPG, JPEG o PNG. DOC y PPT antiguos no se admiten.";
  return null;
}

export function allowedUpload(headers: Headers, origin: string): boolean {
  const content = headers.get("content-type") ?? "";
  return headers.get("origin") === origin && headers.get("x-siare-csrf") === "1"
    && !["cross-site", "none"].includes(headers.get("sec-fetch-site") ?? "")
    && /^multipart\/form-data;\s*boundary=(?:[a-z0-9'()+_,.\/:=?-]{1,70}|"[a-z0-9'()+_,.\/:=? -]{1,70}")$/i.test(content);
}

export class ByteLimitError extends Error {}

/** Count observed bytes, including when Content-Length is absent or untruthful. */
export function boundedStream(source: ReadableStream<Uint8Array>, maximum: number): ReadableStream<Uint8Array> {
  let total = 0;
  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maximum) throw new ByteLimitError("Byte limit exceeded");
      controller.enqueue(chunk);
    },
  }));
}

export const DOCUMENT_EXTENSIONS = ["pdf", "docx", "pptx", "jpg", "jpeg", "png"];
export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

export const DOCUMENT_ERROR_MESSAGES: Record<string, string> = {
  ACTIVE_CONTENT: "El PDF contiene acciones o scripts no permitidos. Exporta una copia sin contenido activo.",
  ATTACHMENTS_NOT_ALLOWED: "El PDF contiene archivos adjuntos no admitidos. Usa una copia sin adjuntos.",
  DOCUMENT_QUARANTINED: "El original está en cuarentena hasta completar su procesamiento seguro.",
  SANDBOX_UNAVAILABLE: "El aislamiento del procesador no está disponible. El original permanece en cuarentena.",
  CHECKSUM_MISMATCH: "La integridad del original no coincide con la carga. El documento permanece en cuarentena.",
  CORRUPT_DOCUMENT: "El archivo está dañado o no corresponde al formato indicado. Vuelve a exportarlo desde la aplicación de origen.",
  FILE_TOO_LARGE: "El archivo supera el límite de carga. Selecciona uno que respete el máximo indicado.",
  DOCUMENT_LIMIT_EXCEEDED: "El documento supera los límites de procesamiento seguro. Usa una versión más pequeña o dividida.",
  PASSWORD_PROTECTED: "El documento está cifrado o protegido con contraseña. Usa una copia sin protección.",
  UNSAFE_DOCUMENT: "El documento contiene contenido no permitido o supera los límites de procesamiento seguro.",
  NOT_FOUND: "No se encontró el recurso solicitado. Recarga la materia y vuelve a intentarlo.",
  UNAUTHORIZED: "La sesión ha expirado. Inicia sesión de nuevo.",
  FORBIDDEN: "No tienes acceso a los documentos de esta materia.",
  CSRF: "La carga requiere un origen válido. Recarga la página y vuelve a intentarlo.",
  SUBJECT_ARCHIVED: "La materia está archivada. Puedes consultar sus documentos, pero no cargar ni procesar archivos.",
  EMPTY_FILE: "El archivo está vacío. Selecciona otro documento.",
  UNSAFE_FILENAME: "Usa un nombre de archivo simple, sin rutas ni caracteres especiales y de hasta 180 caracteres.",
  MIME_MISMATCH: "El contenido y la extensión del archivo no coinciden. Vuelve a exportarlo desde la aplicación de origen.",
};

/** Known public messages only: never render arbitrary upstream diagnostics in an upload error. */
export function documentErrorMessage(code: unknown): string {
  return typeof code === "string" && Object.hasOwn(DOCUMENT_ERROR_MESSAGES, code)
    ? DOCUMENT_ERROR_MESSAGES[code] : "No se pudo cargar el documento. Vuelve a intentarlo.";
}

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

/** Drain a small bounded overage before rejecting so HTTP can return 413 without resetting a still-writing client. */
export function boundedUploadStream(source: ReadableStream<Uint8Array>, maximum: number, overage = 2 * 1024 * 1024): ReadableStream<Uint8Array> {
  let total = 0;
  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maximum + overage) throw new ByteLimitError("Upload drain limit exceeded");
      if (total <= maximum) controller.enqueue(chunk);
    },
    flush() { if (total > maximum) throw new ByteLimitError("Upload byte limit exceeded"); },
  }));
}

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

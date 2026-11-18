import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { allowedUpload, boundedStream, ByteLimitError, DEFAULT_MAX_BYTES } from "../../../../lib/document-policy";
import { sessionName } from "../../../../lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
function failure(status: number, code: string, message: string) {
  return NextResponse.json({ timestamp: new Date().toISOString(), status, code, message, fields: {} },
    { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const path = (await context.params).path.join("/");
  if (!new RegExp(`^subjects/${uuid}/documents$`, "i").test(path)) return failure(404, "NOT_FOUND", "Ruta no encontrada.");
  if (!allowedUpload(request.headers, process.env.APP_ORIGIN ?? "http://127.0.0.1:3100")) return failure(403, "CSRF", "La carga requiere un origen válido y multipart/form-data.");
  const token = request.cookies.get(sessionName())?.value;
  if (!token) return failure(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  const maximum = Number(process.env.DOCUMENT_REQUEST_MAX_BYTES ?? Number(process.env.DOCUMENT_MAX_BYTES ?? DEFAULT_MAX_BYTES) + 131072);
  if (Number(request.headers.get("content-length")) > maximum) return failure(413, "FILE_TOO_LARGE", "La solicitud supera el límite de carga.");
  if (!request.body) return failure(400, "EMPTY_FILE", "Selecciona un archivo.");
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "siare-upload-"));
    const file = join(directory, "multipart.bin");
    // Spooling bounds both RAM and observed bytes before any request reaches Spring.
    await pipeline(Readable.fromWeb(boundedStream(request.body, maximum) as never), createWriteStream(file, { flags: "wx", mode: 0o600 }),
      { signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]) });
    const size = (await stat(file)).size;
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": request.headers.get("content-type")!, "Content-Length": String(size) },
      body: Readable.toWeb(createReadStream(file)), duplex: "half", cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
    } as RequestInit & { duplex: string });
    const data = await new Response(boundedStream(upstream.body!, 131072)).json();
    return NextResponse.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return error instanceof ByteLimitError ? failure(413, "FILE_TOO_LARGE", "La solicitud supera el límite de carga.")
      : failure(503, "SERVICE_UNAVAILABLE", "No se pudo cargar el documento. Vuelve a intentarlo.");
  } finally { if (directory) await rm(directory, { recursive: true, force: true }); }
}

export async function GET(request: NextRequest, context: Context) {
  const path = (await context.params).path.join("/");
  const token = request.cookies.get(sessionName())?.value;
  if (!token) return failure(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  if (path === "limits") return NextResponse.json({ maxBytes: Number(process.env.DOCUMENT_MAX_BYTES ?? DEFAULT_MAX_BYTES) }, { headers: { "Cache-Control": "no-store" } });
  if (!new RegExp(`^documents/${uuid}/download$`, "i").test(path)) return failure(404, "NOT_FOUND", "Ruta no encontrada.");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (request.headers.has("origin") && request.headers.get("origin") !== (process.env.APP_ORIGIN ?? "http://127.0.0.1:3100"))) return failure(403, "CSRF", "Origen no permitido.");
  try {
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
    });
    if (!upstream.ok) {
      const data = await new Response(boundedStream(upstream.body!, 131072)).json();
      return NextResponse.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    }
    const max = Number(process.env.DOCUMENT_MAX_BYTES ?? DEFAULT_MAX_BYTES);
    const length = upstream.headers.get("content-length");
    if (!upstream.body || (length && Number(length) > max)) { await upstream.body?.cancel(); return failure(502, "INVALID_DOWNLOAD", "El archivo supera el límite permitido."); }
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("content-disposition")?.startsWith("attachment;") ? upstream.headers.get("content-disposition")! : "attachment" });
    if (length) headers.set("Content-Length", length);
    return new Response(boundedStream(upstream.body, max), { headers });
  } catch { return failure(503, "SERVICE_UNAVAILABLE", "No se pudo descargar el documento. Vuelve a intentarlo."); }
}

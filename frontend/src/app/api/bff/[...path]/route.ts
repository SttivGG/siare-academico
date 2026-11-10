import { NextRequest, NextResponse } from "next/server";
import { cookieSettings, isAllowedMutation, isAllowedRoute } from "../../../../lib/session-policy";
import { secureCookie, sessionName } from "../../../../lib/server-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ timestamp: new Date().toISOString(), status, code, message, fields: {} },
    { status, headers: { "Cache-Control": "no-store" } });
}

async function handle(request: NextRequest, context: Context) {
  const path = (await context.params).path.join("/");
  if (!isAllowedRoute(request.method, path)) return failure(404, "NOT_FOUND", "Ruta no encontrada.");
  const mutation = request.method !== "GET";
  if (mutation && !isAllowedMutation(request.headers, process.env.APP_ORIGIN ?? "http://127.0.0.1:3100")) {
    return failure(403, "CSRF", "La solicitud no tiene un origen válido. Recarga la página e inténtalo de nuevo.");
  }
  if (path === "auth/logout") {
    const response = NextResponse.json({ message: "Sesión cerrada." }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(sessionName(), "", { ...cookieSettings(secureCookie()), maxAge: 0 });
    return response;
  }
  const publicRoute = path === "auth/register" || path === "auth/login";
  const token = request.cookies.get(sessionName())?.value;
  if (!publicRoute && !token) return failure(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  let body: string | undefined;
  if (mutation) {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16_384) {
          await reader.cancel();
          return failure(413, "PAYLOAD_TOO_LARGE", "La solicitud es demasiado grande.");
        }
        chunks.push(chunk.value);
      }
    }
    body = Buffer.concat(chunks).toString("utf8");
    try { JSON.parse(body); } catch { return failure(400, "VALIDATION", "La solicitud debe contener JSON válido."); }
  }
  try {
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/${path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", ...(!publicRoute ? { Authorization: `Bearer ${token}` } : {}) },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    if (path === "auth/login" && upstream.ok) {
      const expires = new Date(data.expiresAt);
      if (typeof data.accessToken !== "string" || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) {
        return failure(502, "UPSTREAM_ERROR", "No se pudo iniciar la sesión.");
      }
      const response = NextResponse.json({ expiresAt: data.expiresAt }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(sessionName(), data.accessToken, { ...cookieSettings(secureCookie()), expires });
      return response;
    }
    const response = NextResponse.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    if (upstream.status === 401 && !publicRoute) {
      response.cookies.set(sessionName(), "", { ...cookieSettings(secureCookie()), maxAge: 0 });
    }
    return response;
  } catch { return failure(503, "SERVICE_UNAVAILABLE", "SIARE no está disponible. Vuelve a intentarlo en unos segundos."); }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;

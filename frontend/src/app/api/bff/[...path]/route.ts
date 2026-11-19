import { NextRequest, NextResponse } from "next/server";
import { activityRoute, activityQuery, bodyLimit } from "../../../../lib/activity-policy";
import { cookieSettings, isAllowedMutation, isAllowedRoute } from "../../../../lib/session-policy";
import { secureCookie, sessionName, refreshName, challengeName } from "../../../../lib/server-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ timestamp: new Date().toISOString(), status, code, message, fields: {} },
    { status, headers: { "Cache-Control": "no-store" } });
}

async function handle(request: NextRequest, context: Context) {
  const path = (await context.params).path.join("/");
  if (!isAllowedRoute(request.method, path) && !activityRoute(request.method, path)) return failure(404, "NOT_FOUND", "Ruta no encontrada.");
  const activityParams = activityQuery(path, request.nextUrl.searchParams);
  if (!activityParams) return failure(400, "VALIDATION", "Cursor o límite de página inválido.");
  const mutation = request.method !== "GET";
  if (mutation && !isAllowedMutation(request.headers, process.env.APP_ORIGIN ?? "http://127.0.0.1:3100")) {
    return failure(403, "CSRF", "La solicitud no tiene un origen válido. Recarga la página e inténtalo de nuevo.");
  }
  const publicRoute = path.startsWith("auth/") && path !== "auth/logout";
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
        if (size > bodyLimit(request.method, path)) {
          await reader.cancel();
          return failure(413, "PAYLOAD_TOO_LARGE", "La solicitud es demasiado grande.");
        }
        chunks.push(chunk.value);
      }
    }
    body = Buffer.concat(chunks).toString("utf8");
    try {
      const input = JSON.parse(body);
      if (!input || typeof input !== "object" || Array.isArray(input)) return failure(400, "VALIDATION", "La solicitud debe contener un objeto JSON.");
    } catch { return failure(400, "VALIDATION", "La solicitud debe contener JSON válido."); }
  }
  if (path === "auth/refresh") {
    const refreshToken = request.cookies.get(refreshName())?.value;
    if (!refreshToken) return failure(401, "UNAUTHORIZED", "La sesión ha expirado. Inicia sesión de nuevo.");
    body = JSON.stringify({ refreshToken });
  }
  if (path.startsWith("auth/mfa/")) {
    const challengeToken = request.cookies.get(challengeName())?.value;
    if (!challengeToken) return failure(401, "UNAUTHORIZED", "El desafío MFA venció. Inicia sesión de nuevo.");
    // The browser never receives or chooses an authentication challenge bearer.
    const input = JSON.parse(body ?? "{}");
    body = JSON.stringify({ challengeToken, ...(typeof input.code === "string" ? { code: input.code } : {}) });
  }
  try {
    const query = activityParams;
    for (const key of ["limit", "offset"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null && /^\d{1,6}$/.test(value)) query.set(key, value);
    }
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/${path}${query.size ? `?${query}` : ""}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", ...(!publicRoute ? { Authorization: `Bearer ${token}` } : {}) },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    const data = upstream.status === 204 ? {} : await upstream.json();
    if (path === "auth/login" && upstream.ok && data.mfaRequired === true) {
      const expires = new Date(data.challengeExpiresAt);
      if (typeof data.challengeToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.challengeToken) || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) return failure(502, "UPSTREAM_ERROR", "No se pudo crear el desafío.");
      const response = NextResponse.json({ mfaRequired: true, enrollmentRequired: data.enrollmentRequired === true, challengeExpiresAt: data.challengeExpiresAt }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(challengeName(), data.challengeToken, { ...cookieSettings(secureCookie()), sameSite: "strict", expires });
      for (const name of [sessionName(), refreshName()]) response.cookies.set(name, "", { ...cookieSettings(secureCookie()), maxAge: 0 });
      return response;
    }
    const confirmation = path === "auth/mfa/confirm" || path === "users/me/mfa/confirm";
    if ((["auth/login", "auth/refresh", "auth/mfa/verify", "auth/mfa/recover"].includes(path) || confirmation) && upstream.ok) {
      const session = confirmation ? data.session : data;
      const expires = new Date(session?.expiresAt);
      const refreshExpires = new Date(session?.refreshExpiresAt);
      if (typeof session?.accessToken !== "string" || typeof session?.refreshToken !== "string" || !Number.isFinite(refreshExpires.getTime()) || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) {
        return failure(502, "UPSTREAM_ERROR", "No se pudo iniciar la sesión.");
      }
      const response = NextResponse.json({ expiresAt: session.expiresAt, ...(confirmation ? { recoveryCodes: data.recoveryCodes } : {}) }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(sessionName(), session.accessToken, { ...cookieSettings(secureCookie()), expires });
      response.cookies.set(refreshName(), session.refreshToken, { ...cookieSettings(secureCookie()), sameSite: "strict", expires: refreshExpires });
      // Preserve the original two-cookie login response for non-MFA clients.
      if (path !== "auth/login" && path !== "auth/refresh") response.cookies.set(challengeName(), "", { ...cookieSettings(secureCookie()), maxAge: 0 });
      return response;
    }
    const response = NextResponse.json(data, { status: upstream.status === 204 ? 200 : upstream.status, headers: { "Cache-Control": "no-store" } });
    if ((path === "auth/refresh" && upstream.status === 401) || (upstream.ok && ["auth/logout", "users/me/sessions/revoke-all", "users/me/mfa/disable", "users/me/mfa/recovery-codes", "auth/password-reset/complete"].includes(path))) {
      for (const name of [sessionName(), refreshName(), challengeName()]) response.cookies.set(name, "", { ...cookieSettings(secureCookie()), maxAge: 0 });
    }
    return response;
  } catch { return failure(503, "SERVICE_UNAVAILABLE", "SIARE no está disponible. Vuelve a intentarlo en unos segundos."); }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

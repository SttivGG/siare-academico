import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedMutation, cookieSettings } from "../../../../lib/session-policy";
import { sessionName, secureCookie } from "../../../../lib/server-session";
import { isProvider, allowedAuthorizationUrl, matchesOidcCallback, diagnosticCode } from "../../../../lib/oidc-policy";
import { appOrigin, flowCookie, oidcHeaders, oidcDiagnostic } from "../../../../lib/oidc-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const failure = (status: number, message: string) => NextResponse.json({ message }, { status, headers: oidcHeaders });

export async function POST(request: NextRequest) {
  let diagnostic = oidcDiagnostic("unknown", "start");
  const rejected = (status: number, code: string, message: string) => {
    diagnostic.fail(code, status);
    return NextResponse.json({ message, code, reference: diagnostic.id }, { status, headers: { ...oidcHeaders, ...diagnostic.headers } });
  };
  if (!isAllowedMutation(request.headers, appOrigin())) return failure(403, "Recarga la página e inténtalo de nuevo.");
  try {
    const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (!reader) return failure(400, "Solicitud inválida.");
    while (true) { const c = await reader.read(); if (c.done) break; size += c.value.length;
      if (size > 1024) { await reader.cancel(); return failure(413, "Solicitud demasiado grande."); } chunks.push(c.value); }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!input || !isProvider(input.provider) || ![undefined, false, true].includes(input.link)
      || Object.keys(input).some(k => !["provider", "link", "confirmed"].includes(k))) return failure(400, "Solicitud inválida.");
    diagnostic = oidcDiagnostic(input.provider, "start");
    const link = input.link === true, token = request.cookies.get(sessionName())?.value;
    if (link && (!token || input.confirmed !== true)) return failure(403, "Inicia sesión de nuevo y confirma la vinculación.");
    const binding = randomBytes(32).toString("base64url");
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/${link ? "users/me/identities/start" : "auth/oidc/start"}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...diagnostic.headers, ...(link ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ provider: input.provider, binding, confirmed: input.confirmed === true }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(40_000),
    });
    let data;
    try { data = await upstream.json(); } catch { return rejected(502, "OIDC_UPSTREAM_RESPONSE_INVALID", "No se pudo iniciar la conexión."); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return rejected(502, "OIDC_UPSTREAM_RESPONSE_INVALID", "No se pudo iniciar la conexión.");
    if (!upstream.ok) return rejected(upstream.status, diagnosticCode(data.code), "No se pudo iniciar la conexión. Vuelve a intentarlo.");
    if (!allowedAuthorizationUrl(data.authorizationUrl, input.provider)) return rejected(502, "OIDC_AUTHORIZATION_URL_INVALID", "No se pudo iniciar la conexión.");
    if (!matchesOidcCallback(data.authorizationUrl, input.provider, appOrigin())) return rejected(502, "OIDC_REDIRECT_CHANGED", "El proveedor está configurado para otro entorno. Usa tu contraseña o contacta al administrador.");
    const response = NextResponse.json({ authorizationUrl: data.authorizationUrl }, { headers: oidcHeaders });
    response.cookies.set(flowCookie(input.provider), `${binding}.${link ? "link" : "login"}`, { ...cookieSettings(secureCookie()), maxAge: 300 });
    return response;
  } catch { return rejected(503, "OIDC_CORE_UNREACHABLE", "No se pudo contactar al proveedor. Vuelve a intentarlo."); }
}

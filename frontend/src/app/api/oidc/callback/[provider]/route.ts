import { NextRequest, NextResponse } from "next/server";
import { isProvider, validOpaque, callbackInput, diagnosticCode } from "../../../../../lib/oidc-policy";
import { appOrigin, flowCookie, oidcHeaders, oidcResult, oidcDiagnostic } from "../../../../../lib/oidc-server";
import { secureCookie, sessionName } from "../../../../../lib/server-session";
import { cookieSettings } from "../../../../../lib/session-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const diagnostic = oidcDiagnostic(isProvider(provider) ? provider : "unknown", "callback");
  const finish = (response: NextResponse) => {
    for (const [k, v] of Object.entries(oidcHeaders)) response.headers.set(k, v);
    response.headers.set("X-SIARE-OIDC-Diagnostic", diagnostic.id);
    if (isProvider(provider)) response.cookies.set(flowCookie(provider), "", { ...cookieSettings(secureCookie()), maxAge: 0 });
    return response;
  };
  const failed = (code: string, notice = "fallo", status?: number) => {
    diagnostic.fail(code, status);
    const destination = new URL("/login", appOrigin());
    destination.search = new URLSearchParams({ oidc: notice, diagnostico: code, referencia: diagnostic.id }).toString();
    return finish(NextResponse.redirect(destination, 303));
  };
  if (!isProvider(provider)) return failed("OIDC_PROVIDER_INVALID");
  const [binding, mode] = (request.cookies.get(flowCookie(provider))?.value ?? "").split(".");
  const input = callbackInput(request.nextUrl.searchParams);
  if (!input) return failed("OIDC_CALLBACK_INVALID", "contexto");
  if (!validOpaque(binding) || !["link", "login"].includes(mode)) return failed("OIDC_BROWSER_CONTEXT_MISSING", "contexto");
  const token = request.cookies.get(sessionName())?.value;
  if (mode === "link" && !token) return failed("OIDC_LINK_SESSION_MISSING", "contexto");
  try {
    const upstream = await fetch(`${process.env.CORE_API_URL}/api/v1/auth/oidc/complete`, {
      method: "POST", headers: { "Content-Type": "application/json", ...diagnostic.headers, ...(mode === "link" ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...input, provider, binding }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(40_000),
    });
    let data: Record<string, unknown>;
    try { data = await upstream.json(); } catch { return failed("OIDC_UPSTREAM_RESPONSE_INVALID", "proveedor", upstream.status); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return failed("OIDC_UPSTREAM_RESPONSE_INVALID", "proveedor", upstream.status);
    if (!upstream.ok) {
      const code = diagnosticCode(data.code);
      const notice = code === "OIDC_EMAIL_LINK_REQUIRED" ? "vincular" : code === "OIDC_IDENTITY_ALREADY_LINKED" ? "vinculada"
        : code === "OIDC_REGISTRATION_CLOSED" ? "registro" : code === "OIDC_EMAIL_UNVERIFIED" ? "correo"
        : ["OIDC_CONTEXT_INVALID", "OIDC_LINK_SESSION_CHANGED", "OIDC_REDIRECT_CHANGED"].includes(code) ? "contexto"
        : upstream.status === 503 ? "proveedor" : "fallo";
      return failed(code, notice, upstream.status);
    }
    try { return finish(oidcResult(data)); } catch { return failed("OIDC_SIARE_SESSION_INVALID"); }
  } catch { return failed("OIDC_CORE_UNREACHABLE", "proveedor"); }
}

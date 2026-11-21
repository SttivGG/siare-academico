import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieSettings } from "./session-policy";
import { secureCookie, sessionName, refreshName, challengeName } from "./server-session";
import { validOpaque, diagnosticCode, type Provider } from "./oidc-policy";
import { internalLocation } from "./public-origin";

export { appOrigin } from "./public-origin";
export const flowCookie = (provider: string) => `${secureCookie() ? "__Host-" : ""}siare_oidc_${provider}`;
export const oidcHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export function oidcDiagnostic(provider: Provider | "unknown", stage: "start" | "callback") {
  const id = randomUUID();
  return { id, headers: { "X-SIARE-OIDC-Diagnostic": id },
    fail(code: string, status?: number) {
      // Only local labels and a random reference. Never pass exception objects or provider payloads.
      console.warn(JSON.stringify({ event: "oidc_failure", reference: id, provider, stage, code: diagnosticCode(code), ...(status ? { status } : {}) }));
    } };
}

export function oidcResult(data: Record<string, unknown>) {
  const destination = data.linked === true ? "/seguridad?oidc=vinculada" : data.mfaRequired === true
    ? `/login/mfa${data.enrollmentRequired === true ? "?configurar=1" : ""}` : "/inicio";
  const response = new NextResponse(null, { status: 303, headers: { Location: internalLocation(destination) } });
  for (const [key, value] of Object.entries(oidcHeaders)) response.headers.set(key, value);
  if (data.linked === true) return response;
  if (data.mfaRequired === true) {
    const expires = new Date(String(data.challengeExpiresAt));
    if (!validOpaque(data.challengeToken) || !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) throw new Error("Invalid challenge");
    response.cookies.set(challengeName(), data.challengeToken, { ...cookieSettings(secureCookie()), sameSite: "strict", expires });
    for (const name of [sessionName(), refreshName()]) response.cookies.set(name, "", { ...cookieSettings(secureCookie()), maxAge: 0 });
    return response;
  }
  const expires = new Date(String(data.expiresAt)), refreshExpires = new Date(String(data.refreshExpiresAt));
  if (typeof data.accessToken !== "string" || !validOpaque(data.refreshToken) || !Number.isFinite(expires.getTime()) || !Number.isFinite(refreshExpires.getTime()) || expires.getTime() <= Date.now() || refreshExpires.getTime() <= Date.now()) throw new Error("Invalid session");
  response.cookies.set(sessionName(), data.accessToken, { ...cookieSettings(secureCookie()), expires });
  response.cookies.set(refreshName(), data.refreshToken, { ...cookieSettings(secureCookie()), sameSite: "strict", expires: refreshExpires });
  response.cookies.set(challengeName(), "", { ...cookieSettings(secureCookie()), maxAge: 0 });
  return response;
}

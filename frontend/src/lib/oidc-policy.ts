export const providers = ["google", "gitlab"] as const;
export type Provider = typeof providers[number];
const diagnosticCodes = new Set([
  "OIDC_CONTEXT_INVALID", "OIDC_REDIRECT_CHANGED", "OIDC_LINK_SESSION_CHANGED", "OIDC_PROVIDER_DISABLED",
  "OIDC_CONFIGURATION_INVALID", "OIDC_DISCOVERY_FAILED", "OIDC_STORE_UNAVAILABLE", "OIDC_TOKEN_CLIENT_REJECTED",
  "OIDC_TOKEN_GRANT_REJECTED", "OIDC_TOKEN_ENDPOINT_UNAVAILABLE", "OIDC_TOKEN_RESPONSE_INVALID", "OIDC_ID_TOKEN_INVALID",
  "OIDC_ISSUER_INVALID", "OIDC_AUDIENCE_INVALID", "OIDC_AZP_INVALID", "OIDC_TOKEN_EXPIRED", "OIDC_TOKEN_ISSUED_IN_FUTURE",
  "OIDC_NONCE_INVALID", "OIDC_EMAIL_LINK_REQUIRED", "OIDC_EMAIL_UNVERIFIED", "OIDC_REGISTRATION_CLOSED",
  "OIDC_IDENTITY_ALREADY_LINKED", "OIDC_ACCOUNT_REJECTED", "OIDC_INTERNAL_ERROR", "OIDC_RATE_LIMITED", "OIDC_UPSTREAM_REJECTED",
  "OIDC_PROVIDER_INVALID", "OIDC_CALLBACK_INVALID", "OIDC_BROWSER_CONTEXT_MISSING", "OIDC_LINK_SESSION_MISSING",
  "OIDC_UPSTREAM_RESPONSE_INVALID", "OIDC_SIARE_SESSION_INVALID", "OIDC_CORE_UNREACHABLE", "OIDC_AUTHORIZATION_URL_INVALID",
]);
export function diagnosticCode(value: unknown): string {
  return typeof value === "string" && diagnosticCodes.has(value) ? value : "OIDC_UPSTREAM_REJECTED";
}
export function oidcNotice(value: string) {
  switch (value) {
    case "vincular": return "Ya existe una cuenta con ese correo. Inicia sesión y vincula el proveedor desde Seguridad.";
    case "contexto": return "La conexión venció, fue cancelada o pertenece a otro navegador. Vuelve a intentarlo.";
    case "proveedor": return "No se pudo contactar al servicio de identidad. Vuelve a iniciar la conexión.";
    case "registro": return "El registro público está cerrado. Puedes iniciar sesión con una cuenta existente.";
    case "correo": return "Google debe confirmar tu correo electrónico antes de crear tu cuenta SIARE.";
    case "vinculada": return "Esa identidad ya está vinculada. Inicia sesión con su cuenta SIARE; no se modificó ninguna cuenta.";
    default: return "No se pudo verificar la identidad externa. Vuelve a intentarlo o usa tu contraseña.";
  }
}
export function isProvider(value: string): value is Provider { return providers.some(p => p === value); }
export function validOpaque(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value); }
export function callbackInput(params: URLSearchParams) {
  if (["code", "state", "error"].some(k => params.getAll(k).length > 1)) return null;
  const state = params.get("state"), code = params.get("code");
  if (!validOpaque(state) || params.has("error") || !code || code.length > 4096) return null;
  return { state, code };
}
export function allowedAuthorizationUrl(value: unknown, provider: Provider) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.hostname === (provider === "google" ? "accounts.google.com" : "gitlab.com");
  } catch { return false; }
}

export function matchesOidcCallback(value: string, provider: Provider, origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(value);
    const callbacks = url.searchParams.getAll("redirect_uri");
    return callbacks.length === 1 && callbacks[0] === `${origin}/api/oidc/callback/${provider}`;
  } catch { return false; }
}

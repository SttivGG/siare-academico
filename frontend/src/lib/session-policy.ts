export const SESSION_SECONDS = 5 * 60;

export function cookieSettings(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
}

export function isAllowedMutation(headers: Headers, configuredOrigin: string): boolean {
  return headers.get("origin") === configuredOrigin
    && headers.get("x-siare-csrf") === "1"
    && headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json"
    && !["cross-site", "none"].includes(headers.get("sec-fetch-site") ?? "");
}

export function isAllowedRoute(method: string, path: string): boolean {
  if (method === "POST") return ["auth/register", "auth/login", "auth/logout", "auth/refresh", "auth/mfa/enroll", "auth/mfa/confirm", "auth/mfa/verify", "auth/mfa/recover", "auth/password-reset/request", "auth/password-reset/complete", "users/me/mfa/enroll", "users/me/mfa/confirm", "users/me/mfa/disable", "users/me/mfa/recovery-codes", "users/me/sessions/revoke-others", "users/me/sessions/revoke-all", "admin/scopes", "subjects"].includes(path) || /^documents\/[0-9a-f-]{36}\/process$/i.test(path);
  if (method === "GET") return ["auth/oidc/providers", "users/me/identities", "users/me", "users/me/identity", "users/me/sessions", "users/me/mfa", "admin/overview", "admin/users", "admin/scopes", "admin/audit", "admin/parameters/public-registration", "subjects"].includes(path) || /^subjects\/[0-9a-f-]{36}(\/documents)?$/i.test(path) || /^documents\/[0-9a-f-]{36}(\/text)?$/i.test(path);
  if (method === "PATCH") return path === "admin/parameters/public-registration" || /^subjects\/[0-9a-f-]{36}(\/archive)?$/i.test(path) || /^admin\/users\/[0-9a-f-]{36}\/access$/i.test(path);
  if (method === "DELETE") return /^users\/me\/identities\/[0-9a-f-]{36}$/i.test(path) || /^users\/me\/sessions\/[0-9a-f-]{36}$/i.test(path);
  return false;
}

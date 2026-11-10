export const SESSION_SECONDS = 30 * 60;

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
  if (method === "POST") return ["auth/register", "auth/login", "auth/logout", "subjects"].includes(path) || /^documents\/[0-9a-f-]{36}\/process$/i.test(path);
  if (method === "GET") return ["users/me", "subjects"].includes(path) || /^subjects\/[0-9a-f-]{36}(\/documents)?$/i.test(path) || /^documents\/[0-9a-f-]{36}(\/text)?$/i.test(path);
  if (method === "PATCH") return /^subjects\/[0-9a-f-]{36}(\/archive)?$/i.test(path);
  return false;
}

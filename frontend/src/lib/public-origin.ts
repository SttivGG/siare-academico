// Deployment configuration is the trust boundary. Never infer it from request headers.
export function appOrigin(value = process.env.APP_ORIGIN): string {
  if (!value || value !== value.trim()) return "";
  try {
    const url = new URL(value);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
      || !(url.protocol === "https:" || url.protocol === "http:" && loopback)) return "";
    return url.origin;
  } catch { return ""; }
}

// Only application-owned paths reach Location; no request-controlled return URL.
export function internalLocation(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\x00-\x20\x7f]/.test(path)) throw new Error("Invalid internal destination");
  const base = "https://internal.invalid";
  const url = new URL(path, base);
  if (url.origin !== base) throw new Error("Invalid internal destination");
  return url.pathname + url.search;
}

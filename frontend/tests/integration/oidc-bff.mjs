import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Actual compiled Next routes, isolated loopback upstream. No external provider requests.
let app, upstream, origin, mode = "login", upstreamCalls = 0, diagnostics = "";
const flows = new Map();
const opaque = () => randomBytes(32).toString("base64url");
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const cookie = response => response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
const session = () => ({ accessToken: "controlled-siare-access", refreshToken: opaque(), expiresAt: new Date(Date.now() + 300_000).toISOString(), refreshExpiresAt: new Date(Date.now() + 600_000).toISOString() });
before(async () => {
  upstream = createServer(async (request, response) => {
    upstreamCalls++; let raw = ""; for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw || "{}"); response.setHeader("Content-Type", "application/json");
    const reply = (status, data) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    if (request.url.endsWith("/start")) {
      const state = opaque(); const link = request.url.includes("/users/me/");
      if (link && (!input.confirmed || request.headers.authorization !== "Bearer original-session")) return reply(403, { message: "Inicia sesión y confirma." });
      flows.set(state, { provider: input.provider, binding: input.binding, mode: link ? "link" : mode });
      const callbackOrigin = mode === "wrong-origin" ? "http://127.0.0.1:3100" : origin;
      return reply(200, { authorizationUrl: `https://${input.provider === "google" ? "accounts.google.com/authorize" : "gitlab.com/oauth/authorize"}?state=${state}&redirect_uri=${encodeURIComponent(`${callbackOrigin}/api/oidc/callback/${input.provider}`)}` });
    }
    assert.match(request.headers["x-siare-oidc-diagnostic"] ?? "", /^[a-f0-9-]{36}$/);
    const flow = flows.get(input.state); flows.delete(input.state);
    if (!flow || flow.provider !== input.provider || flow.binding !== input.binding || flow.mode === "link" && request.headers.authorization !== "Bearer original-session") return reply(401, {});
    if (flow.mode.startsWith("OIDC_")) return reply(flow.mode === "OIDC_EMAIL_LINK_REQUIRED" ? 409 : 401, { code: flow.mode, message: "private-provider-description-do-not-log" });
    if (flow.mode === "unknown-error") return reply(500, { code: "private-code-do-not-log", message: "private-message-do-not-log" });
    if (flow.mode === "invalid-session") return reply(200, {});
    return reply(200, flow.mode === "link" ? { linked: true } : flow.mode === "mfa" ? { mfaRequired: true, enrollmentRequired: false, challengeToken: opaque(), challengeExpiresAt: new Date(Date.now() + 300_000).toISOString() } : session());
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer(); const port = await listen(reservation); await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  const environment = Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  app = spawn(process.execPath, [process.env.OIDC_TEST_SERVER ?? fileURLToPath(new URL("../../.next/standalone/server.js", import.meta.url))], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), stdio: ["ignore", "ignore", "pipe"],
    env: { ...environment, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", APP_ORIGIN: origin, CORE_API_URL: `http://127.0.0.1:${upstreamPort}`, SESSION_COOKIE_SECURE: "false", NEXT_TELEMETRY_DISABLED: "1" },
  });
  app.stderr.on("data", chunk => { diagnostics += chunk.toString(); });
  let ready = false;
  for (let i = 0; i < 80; i++) { try { await fetch(origin + "/api/oidc/start"); ready = true; break; } catch {} await delay(250); }
  assert.ok(ready, "Compiled Next server must start");
});
after(async () => {
  app?.kill(); if (upstream) await new Promise(resolve => upstream.close(resolve));
  for (const value of ["private-provider-description-do-not-log", "private-code-do-not-log", "private-message-do-not-log", "controlled-siare-access", "original-session", "different-session", "code=controlled"])
    assert.ok(!diagnostics.includes(value), "Diagnostics must not contain sensitive or untrusted data");
});
function failureLocation(response, notice, code) {
  const url = new URL(response.headers.get("location"), origin);
  assert.equal(url.origin, origin); assert.equal(url.pathname, "/login"); assert.equal(url.searchParams.get("oidc"), notice);
  if (code) assert.equal(url.searchParams.get("diagnostico"), code);
  assert.equal(url.searchParams.get("referencia"), response.headers.get("x-siare-oidc-diagnostic"));
  assert.match(url.searchParams.get("referencia"), /^[a-f0-9-]{36}$/);
}
async function start(extra = {}, cookies = "") {
  return fetch(origin + "/api/oidc/start", { method: "POST", headers: { Origin: origin, "X-SIARE-CSRF": "1", "Content-Type": "application/json", Cookie: cookies }, body: JSON.stringify({ provider: "google", ...extra }) });
}
async function callback(response, extraCookies = "") {
  const { authorizationUrl } = await response.json();
  const state = new URL(authorizationUrl).searchParams.get("state");
  const provider = new URL(authorizationUrl).hostname === "gitlab.com" ? "gitlab" : "google";
  return fetch(`${origin}/api/oidc/callback/${provider}?state=${state}&code=controlled`, { headers: { Cookie: cookie(response) + "; " + extraCookies }, redirect: "manual" });
}
test("actual BFF enforces CSRF, input allowlist and missing-context rejection", async () => {
  const beforeCalls = upstreamCalls;
  assert.equal((await fetch(origin + "/api/oidc/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await start({ redirectUri: "https://evil.example" })).status, 400);
  const response = await fetch(`${origin}/api/oidc/callback/google?state=${opaque()}&code=x`, { redirect: "manual" });
  assert.equal(response.status, 303); failureLocation(response, "contexto", "OIDC_BROWSER_CONTEXT_MISSING");
  assert.equal(upstreamCalls, beforeCalls);
});

test("actual BFF blocks the shared core's 3100 callback before sending a preview browser to a provider", async () => {
  mode = "wrong-origin";
  for (const provider of ["google", "gitlab"]) {
    const response = await start({ provider });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.code, "OIDC_REDIRECT_CHANGED");
    assert.equal(body.authorizationUrl, undefined);
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  mode = "login";
});

test("callback Location stays relative despite spoofed host headers and manipulated return parameters", async () => {
  for (const target of ["http://127.0.0.1:3100/login", "https://evil.example", "//evil.example", "/\\evil.example"]) {
    const params = new URLSearchParams({ next: target, returnTo: target, callbackUrl: target });
    const response = await fetch(`${origin}/api/oidc/callback/google?${params}`, { redirect: "manual", headers: { Host: "evil.example", "X-Forwarded-Host": "127.0.0.1:3100", "X-Forwarded-Proto": "https" } });
    assert.equal(response.status, 303);
    assert.ok(response.headers.get("location").startsWith("/login?"));
    assert.equal(new URL(response.headers.get("location"), origin).origin, origin);
    assert.ok(!response.headers.get("location").includes(target));
  }
});
test("actual BFF installs only HttpOnly SIARE credentials and consumes flow cookie", async () => {
  mode = "login"; const started = await start(); assert.equal(started.status, 200);
  assert.match(started.headers.get("set-cookie"), /HttpOnly/i); assert.match(started.headers.get("set-cookie"), /SameSite=lax/i);
  const response = await callback(started);
  assert.equal(response.status, 303); assert.equal(new URL(response.headers.get("location"), origin).href, origin + "/inicio");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(c => c.startsWith("siare_session=") && /HttpOnly/i.test(c)));
  assert.ok(cookies.some(c => c.startsWith("siare_refresh=") && /HttpOnly/i.test(c) && /SameSite=strict/i.test(c)));
  assert.ok(cookies.some(c => c.startsWith("siare_oidc_google=") && /Max-Age=0/i.test(c)));
  assert.equal(await response.text(), "");
});
test("actual BFF continues to own MFA without granting an application session", async () => {
  mode = "mfa"; const response = await callback(await start());
  assert.equal(new URL(response.headers.get("location"), origin).href, origin + "/login/mfa");
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(c => /^siare_mfa=[A-Za-z0-9_-]{43};/.test(c) && /HttpOnly/i.test(c) && /SameSite=strict/i.test(c)));
  for (const key of ["siare_session", "siare_refresh"]) assert.ok(cookies.some(c => c.startsWith(key + "=;") && /Max-Age=0/i.test(c)));
});

test("GitLab BFF supports its own callback, SIARE session, MFA and explicit linking; Microsoft is rejected", async () => {
  const beforeCalls = upstreamCalls;
  assert.equal((await start({ provider: "microsoft" })).status, 400);
  assert.equal(upstreamCalls, beforeCalls);
  mode = "login";
  const started = await start({ provider: "gitlab" });
  assert.equal(started.status, 200);
  assert.ok(started.headers.getSetCookie().some(c => c.startsWith("siare_oidc_gitlab=") && /HttpOnly/i.test(c)));
  const loggedIn = await callback(started);
  assert.equal(new URL(loggedIn.headers.get("location"), origin).href, origin + "/inicio");
  assert.ok(loggedIn.headers.getSetCookie().some(c => c.startsWith("siare_session=") && /HttpOnly/i.test(c)));
  assert.ok(loggedIn.headers.getSetCookie().some(c => c.startsWith("siare_oidc_gitlab=;") && /Max-Age=0/i.test(c)));
  mode = "mfa";
  const mfa = await callback(await start({ provider: "gitlab" }));
  assert.equal(new URL(mfa.headers.get("location"), origin).href, origin + "/login/mfa");
  assert.ok(!mfa.headers.getSetCookie().some(c => /^siare_(session|refresh)=[^;]/.test(c)));
  assert.equal((await start({ provider: "gitlab", link: true }, "siare_session=original-session")).status, 403);
  const linked = await callback(await start({ provider: "gitlab", link: true, confirmed: true }, "siare_session=original-session"), "siare_session=original-session");
  assert.equal(new URL(linked.headers.get("location"), origin).href, origin + "/seguridad?oidc=vinculada");
  assert.ok(!linked.headers.getSetCookie().some(c => /^siare_(session|refresh)=/.test(c)));
});
test("link requires confirmation and original current session; valid link sets no credentials", async () => {
  assert.equal((await start({ link: true }, "siare_session=original-session")).status, 403);
  const rejected = await callback(await start({ link: true, confirmed: true }, "siare_session=original-session"), "siare_session=different-session");
  failureLocation(rejected, "fallo", "OIDC_UPSTREAM_REJECTED");
  const response = await callback(await start({ link: true, confirmed: true }, "siare_session=original-session"), "siare_session=original-session");
  assert.equal(new URL(response.headers.get("location"), origin).href, origin + "/seguridad?oidc=vinculada");
  assert.equal(response.headers.getSetCookie().filter(c => c.startsWith("siare_session=") || c.startsWith("siare_refresh=")).length, 0);
});
test("callback distinguishes external validation, account collision and invalid upstream responses without exposing payloads", async () => {
  for (const [value, notice, code] of [
    ["OIDC_NONCE_INVALID", "fallo", "OIDC_NONCE_INVALID"],
    ["OIDC_TOKEN_GRANT_REJECTED", "fallo", "OIDC_TOKEN_GRANT_REJECTED"],
    ["OIDC_EMAIL_LINK_REQUIRED", "vincular", "OIDC_EMAIL_LINK_REQUIRED"],
    ["OIDC_IDENTITY_ALREADY_LINKED", "vinculada", "OIDC_IDENTITY_ALREADY_LINKED"],
    ["OIDC_CONTEXT_INVALID", "contexto", "OIDC_CONTEXT_INVALID"],
    ["unknown-error", "fallo", "OIDC_UPSTREAM_REJECTED"],
    ["invalid-session", "fallo", "OIDC_SIARE_SESSION_INVALID"],
  ]) {
    mode = value; const response = await callback(await start()); failureLocation(response, notice, code);
    assert.ok(response.headers.getSetCookie().some(c => c.startsWith("siare_oidc_google=;") && /Max-Age=0/i.test(c)));
    assert.ok(!response.headers.getSetCookie().some(c => /^siare_(session|refresh)=[^;]/.test(c)));
  }
});

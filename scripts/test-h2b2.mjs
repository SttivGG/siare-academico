import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const origin = "http://127.0.0.1:3100", core = "http://127.0.0.1:8180";
const evidence = JSON.parse(readFileSync(new URL("../.cache/h2b2-oidc-session.json", import.meta.url), "utf8"));
let checks = 0;
async function check(path, expected, init = {}, base = core) {
  const response = await fetch(base + path, { ...init, redirect: "manual", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, expected, path); checks++;
  return response;
}
// Test-profile JWT keys are isolated. The persistent opaque refresh is redeemed
// by the production API after restart, which issues credentials with its RSA key.
const renewedResponse = await check("/api/v1/auth/refresh", 200, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: evidence.session.refreshToken }) });
const renewed = await renewedResponse.json();
assert.ok(renewed.accessToken && renewed.refreshToken); checks++;
assert.equal(renewed.sessionId, evidence.session.sessionId); checks++;
const authorization = { Authorization: `Bearer ${renewed.accessToken}` };
const me = await check("/api/v1/users/me", 200, { headers: authorization });
assert.equal((await me.json()).id, evidence.user); checks++;
await check("/api/v1/admin/users", 403, { headers: authorization });
await check("/api/v1/users/me/identities", 200, { headers: authorization });
await check("/api/v1/auth/logout", 200, { method: "POST", headers: { Authorization: `Bearer ${renewed.accessToken}`, "Content-Type": "application/json" }, body: "{}" });
await check("/api/v1/users/me", 401, { headers: { Authorization: `Bearer ${renewed.accessToken}` } });
await check("/api/v1/auth/refresh", 401, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: renewed.refreshToken }) });
await check("/api/oidc/start", 403, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "google" }) }, origin);
const providers = await (await check("/api/v1/auth/oidc/providers", 200)).json();
assert.deepEqual(providers.map(p => p.provider), ["google", "gitlab"]); checks++;
await check("/api/v1/auth/oidc/start", 400, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "microsoft", binding: "x".repeat(43) }) });
await check("/api/oidc/start", 400, { method: "POST", headers: { Origin: origin, "X-SIARE-CSRF": "1", "Content-Type": "application/json" }, body: JSON.stringify({ provider: "microsoft" }) }, origin);
for (const provider of providers.filter(p => !p.enabled)) {
  await check("/api/oidc/start", 404, { method: "POST", headers: { Origin: origin, "X-SIARE-CSRF": "1", "Content-Type": "application/json" }, body: JSON.stringify({ provider: provider.provider }) }, origin);
}
const callback = await check(`/api/oidc/callback/google?state=${"x".repeat(43)}&code=controlled`, 303, {}, origin);
assert.equal(callback.headers.get("referrer-policy"), "no-referrer"); checks++;
const googleDestination = new URL(callback.headers.get("location"));
assert.equal(googleDestination.origin + googleDestination.pathname, origin + "/login"); checks++;
assert.equal(googleDestination.searchParams.get("oidc"), "contexto"); checks++;
const gitlabCallback = await check(`/api/oidc/callback/gitlab?state=${"x".repeat(43)}&code=controlled`, 303, {}, origin);
assert.equal(gitlabCallback.headers.get("referrer-policy"), "no-referrer"); checks++;
const destination = new URL(gitlabCallback.headers.get("location"));
assert.equal(destination.origin + destination.pathname, origin + "/login"); checks++;
assert.equal(destination.searchParams.get("diagnostico"), "OIDC_BROWSER_CONTEXT_MISSING"); checks++;
console.log(`OK: ${checks} comprobaciones H2-B2; sesión OIDC persistente, refresh, revocación, BFF y proveedores desactivados. Sin imprimir tokens.`);

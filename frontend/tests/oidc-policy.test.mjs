import assert from "node:assert/strict";
import { test } from "node:test";
import { callbackInput, isProvider, allowedAuthorizationUrl, diagnosticCode, oidcNotice } from "../src/lib/oidc-policy.ts";
import { isAllowedRoute } from "../src/lib/session-policy.ts";

test("callback accepts a bounded code and opaque state, rejects ambiguity and errors", () => {
  const state = "x".repeat(43);
  assert.deepEqual(callbackInput(new URLSearchParams({state, code:"controlled-code"})), {state, code:"controlled-code"});
  for (const q of ["code=x", `state=${state}&code=a&code=b`, `state=${state}&code=a&error=access_denied`, `state=${state}&code=${"x".repeat(4097)}`, `state=${state}&state=${state}&code=a`]) assert.equal(callbackInput(new URLSearchParams(q)), null);
});
test("diagnostics accept only fixed internal codes and give actionable account-conflict guidance", () => {
  assert.equal(diagnosticCode("OIDC_NONCE_INVALID"), "OIDC_NONCE_INVALID");
  for (const value of ["OIDC_PRIVATE_SECRET", "invalid_grant", "code=oauth-secret", null, {}]) assert.equal(diagnosticCode(value), "OIDC_UPSTREAM_REJECTED");
  assert.match(oidcNotice("vincular"), /Inicia sesión.*Seguridad/);
  assert.match(oidcNotice("registro"), /registro público está cerrado/);
});
test("only configured provider hosts over HTTPS can receive the browser", () => {
  assert.equal(allowedAuthorizationUrl("https://accounts.google.com/o/oauth2/v2/auth?state=x", "google"), true);
  assert.equal(allowedAuthorizationUrl("https://gitlab.com/oauth/authorize", "gitlab"), true);
  for (const url of ["http://accounts.google.com/auth", "https://accounts.google.com.evil.test/auth", "https://user@accounts.google.com/auth", "https://accounts.google.com:444/auth", "javascript:alert(1)", "/login"]) assert.equal(allowedAuthorizationUrl(url, "google"), false);
  assert.equal(isProvider("common"), false); assert.equal(isProvider("google"), true);
  assert.equal(isProvider("gitlab"), true); assert.equal(isProvider("microsoft"), false);
  for (const url of ["http://gitlab.com/oauth/authorize", "https://gitlab.com.evil.test/oauth/authorize", "https://user@gitlab.com/oauth/authorize", "https://gitlab.com:444/oauth/authorize", "https://accounts.google.com/auth", "https://login.microsoftonline.com/authorize"])
    assert.equal(allowedAuthorizationUrl(url, "gitlab"), false);
});
test("generic BFF cannot start or complete an OIDC flow with browser-chosen bindings", () => {
  for (const path of ["auth/oidc/start", "auth/oidc/complete", "users/me/identities/start"]) assert.equal(isAllowedRoute("POST", path), false);
  assert.equal(isAllowedRoute("GET", "auth/oidc/providers"), true);
  assert.equal(isAllowedRoute("GET", "users/me/identities"), true);
  assert.equal(isAllowedRoute("DELETE", "users/me/identities/00000000-0000-0000-0000-000000000001"), true);
});

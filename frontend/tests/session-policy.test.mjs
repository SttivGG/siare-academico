import assert from "node:assert/strict";
import { test } from "node:test";
import { cookieSettings, isAllowedMutation, isAllowedRoute } from "../src/lib/session-policy.ts";

test("session cookies are HttpOnly, same-site and secure by configuration", () => {
  assert.deepEqual(cookieSettings(true), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  assert.equal(cookieSettings(false).secure, false);
});

test("CSRF boundary requires exact origin, custom header, JSON and a same-site request", () => {
  const origin = "https://siare.example";
  const headers = new Headers({ origin, "x-siare-csrf": "1", "content-type": "application/json; charset=utf-8", "sec-fetch-site": "same-origin" });
  assert.equal(isAllowedMutation(headers, origin), true);
  for (const [key, value] of [["origin", "https://evil.example"], ["origin", "null"], ["x-siare-csrf", ""], ["content-type", "text/plain"], ["sec-fetch-site", "cross-site"]]) {
    const altered = new Headers(headers); altered.set(key, value);
    assert.equal(isAllowedMutation(altered, origin), false, key);
  }
  const missing = new Headers(headers); missing.delete("origin");
  assert.equal(isAllowedMutation(missing, origin), false);
});

test("BFF cannot proxy arbitrary paths or methods", () => {
  assert.equal(isAllowedRoute("GET", "users/me"), true);
  assert.equal(isAllowedRoute("POST", "auth/login"), true);
  assert.equal(isAllowedRoute("PATCH", "subjects/00000000-0000-0000-0000-000000000000/archive"), true);
  for (const path of ["../actuator/env", "auth/login/extra", "https://evil.example", "subjects/../users/me"]) assert.equal(isAllowedRoute("GET", path), false);
  assert.equal(isAllowedRoute("DELETE", "subjects"), false);
});

import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { compose } from "./compose-command.mjs";

const core = "http://127.0.0.1:8180/api/v1/";
const frontend = "http://127.0.0.1:3100";
const password = `Prueba-${randomBytes(18).toString("hex")}`;
const suffix = randomUUID();
const email = `phase1-${suffix}@example.test`;
let checks = 0;
async function request(base, path, method = "GET", body, token, expected = 200, extra = {}) {
  const response = await fetch(base + path, { method, redirect: "manual", signal: AbortSignal.timeout(15000),
    // Do not reuse sockets across the deliberate Docker restart in this harness.
    headers: { "Content-Type": "application/json", Connection: "close", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal(response.status, expected, `${method} ${path}: expected HTTP ${expected}, received ${response.status}`);
  checks++;
  return response;
}
const json = response => response.json();
const registerBody = { name: "Prueba de fase 1", email, password };
const user = await json(await request(core, "auth/register", "POST", registerBody, null, 201));
assert.equal(user.email, email);
assert.equal(user.passwordHash, undefined);
assert.equal(user.password, undefined);
await request(core, "auth/register", "POST", { ...registerBody, email: ` ${email.toUpperCase()} ` }, null, 409);
await request(core, "auth/register", "POST", { name: "", email: "invalid", password: "short" }, null, 400);
const auth = await json(await request(core, "auth/login", "POST", { email, password }));
const token = auth.accessToken;
const [header, claims] = token.split(".").slice(0, 2).map(value => JSON.parse(Buffer.from(value, "base64url").toString()));
assert.equal(header.alg, "RS256");
assert.equal(claims.sub, user.id);
assert.equal(claims.exp - claims.iat, 1800);
assert.equal(auth.tokenType, "Bearer");
await request(core, "auth/login", "POST", { email, password: "wrong" }, null, 401);
await request(core, "subjects", "GET", undefined, undefined, 401);
await request(core, "users/me", "GET", undefined, "invalid", 401);
const me = await json(await request(core, "users/me", "GET", undefined, token));
assert.equal(me.id, user.id);
const subject = await json(await request(core, "subjects", "POST", { name: "Materia de validación", description: "Debe persistir después del reinicio." }, token, 201));
let own = await json(await request(core, "subjects", "GET", undefined, token));
assert.deepEqual(own.map(item => item.id), [subject.id]);
const otherEmail = `other-${suffix}@example.test`;
await request(core, "auth/register", "POST", { ...registerBody, email: otherEmail }, null, 201);
const other = await json(await request(core, "auth/login", "POST", { email: otherEmail, password }));
assert.deepEqual(await json(await request(core, "subjects", "GET", undefined, other.accessToken)), []);
await request(core, `subjects/${subject.id}`, "GET", undefined, other.accessToken, 403);
await request(core, `subjects/${subject.id}`, "PATCH", { name: "Intrusión" }, other.accessToken, 403);
await request(core, `subjects/${subject.id}/archive`, "PATCH", {}, other.accessToken, 403);
const updated = await json(await request(core, `subjects/${subject.id}`, "PATCH", { name: "Materia actualizada" }, token));
assert.equal(updated.name, "Materia actualizada");
assert.equal(updated.description, subject.description);
await request(core, `subjects/${subject.id}`, "PATCH", { description: null }, token);
const archived = await json(await request(core, `subjects/${subject.id}/archive`, "PATCH", {}, token));
assert.equal(archived.archived, true);
await request(core, `subjects/${subject.id}`, "PATCH", { name: "No debe editarse" }, token, 400);

// Exercise the actual database UNIQUE constraint under concurrent registration.
const raceBody = { ...registerBody, email: `race-${suffix}@example.test` };
const race = await Promise.all([0, 1].map(() => fetch(core + "auth/register", { method: "POST", headers: { "Content-Type": "application/json", Connection: "close" }, body: JSON.stringify(raceBody), signal: AbortSignal.timeout(15000) })));
assert.deepEqual(race.map(response => response.status).sort(), [201, 409]);
checks++;

const bff = frontend + "/api/bff/";
const browserHeaders = { Origin: frontend, "X-SIARE-CSRF": "1", "Sec-Fetch-Site": "same-origin" };
const bffEmail = `bff-${suffix}@example.test`;
await request(bff, "auth/register", "POST", { ...registerBody, email: bffEmail }, null, 201, browserHeaders);
const loginResponse = await request(bff, "auth/login", "POST", { email: bffEmail, password }, null, 200, browserHeaders);
const publicAuth = await loginResponse.json();
assert.equal(publicAuth.accessToken, undefined);
const sessionHeader = loginResponse.headers.getSetCookie().find(cookie => cookie.startsWith("siare_session="));
assert.ok(sessionHeader, "The local HTTP session cookie must exist");
assert.ok(/HttpOnly/i.test(sessionHeader), "The session cookie must be HttpOnly");
assert.ok(/SameSite=lax/i.test(sessionHeader), "The session cookie must use SameSite=Lax");
const cookie = sessionHeader.split(";")[0];
const session = { ...browserHeaders, Cookie: cookie };
await request(bff, "subjects", "GET", undefined, null, 401);
await request(bff, "subjects", "POST", { name: "Sin Origin" }, null, 403, { Cookie: cookie, "X-SIARE-CSRF": "1" });
await request(bff, "subjects", "POST", { name: "CSRF" }, null, 403, { ...session, Origin: "https://evil.example" });
await request(bff, "subjects", "POST", { name: "Sin cabecera CSRF" }, null, 403, { Origin: frontend, Cookie: cookie });
const bffSubject = await json(await request(bff, "subjects", "POST", { name: "Materia desde Next.js" }, null, 201, session));
const html = await request(frontend, "/inicio", "GET", undefined, null, 200, session);
assert.match(await html.text(), /Hola,/);
assert.equal((await json(await request(bff, "subjects", "GET", undefined, null, 200, session)))[0].id, bffSubject.id);

if (process.argv.includes("--restart")) {
  console.log("Reiniciando exclusivamente los nueve contenedores de esta composición; se conservan sus volúmenes.");
  compose("restart");
  compose("up", "--detach", "--wait", "--wait-timeout", "900");
  // A token issued before restart must still pass RSA verification afterwards.
  assert.equal((await json(await request(core, "users/me", "GET", undefined, token))).id, user.id);
  const persisted = await json(await request(core, `subjects/${subject.id}`, "GET", undefined, token));
  assert.equal(persisted.archived, true);
  assert.equal(persisted.name, "Materia actualizada");
  assert.equal(persisted.description, null);
  assert.equal((await json(await request(bff, `subjects/${bffSubject.id}`, "GET", undefined, null, 200, session))).id, bffSubject.id);
  console.log("OK: usuarios, materias, archivo, sesión BFF y firma RSA persisten tras reiniciar los nueve contenedores.");
}
const logout = await request(bff, "auth/logout", "POST", {}, null, 200, session);
assert.ok(/Max-Age=0/i.test(logout.headers.get("set-cookie") ?? ""), "Logout must clear the session cookie");
console.log(`OK: ${checks} verificaciones HTTP reales; registro, login, propiedad, edición, archivo, concurrencia y BFF/CSRF.`);
console.log("Se conservaron las cuentas y materias sintéticas @example.test de esta prueba; no se eliminaron datos.");

import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
// Ordinary integration never reads .env or obtains access to the Docker control plane.
const compose = process.argv.some(arg => arg === "--outage" || arg === "--restart")
  ? (await import("./compose-command.mjs")).compose : undefined;

const core = process.env.SIARE_TEST_CORE_URL ?? "http://127.0.0.1:8180/api/v1/";
const frontend = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const bff = frontend + "/api/bff/";
const browser = { Origin: frontend, "X-SIARE-CSRF": "1", "Sec-Fetch-Site": "same-origin" };
const password = `Synthetic-${randomUUID()}`;
const email = `phase2-${randomUUID()}@example.test`;
let checks = 0;
async function request(base, path, { method = "GET", body, token, headers = {}, expected = 200, duplex } = {}) {
  const response = await fetch(base + path, { method, redirect: "manual", signal: AbortSignal.timeout(60_000),
    headers: { Connection: "close", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body,
    ...(duplex ? { duplex } : {}) }).catch(error => { throw new Error(`${method} ${base}${path}: transport failure`, { cause: error }); });
  assert.equal(response.status, expected, `${method} ${path}: ${response.status}; ${response.status === expected ? "" : await response.text()}`);
  checks++;
  return response;
}
async function json(path, method, body, token, expected = 200, headers = {}, base = core) {
  return (await request(base, path, { method, token, expected, headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })).json();
}
async function account(address) {
  await json("auth/register", "POST", { name: "Estudiante sintético fase 2", email: address, password }, null, 201);
  return (await json("auth/login", "POST", { email: address, password })).accessToken;
}
async function upload(subjectId, name, bytes, mime, token, expected = 201, base = core, headers = {}) {
  const body = new FormData(); body.append("file", new Blob([bytes], { type: mime }), name);
  return (await request(base, `subjects/${subjectId}/documents`, { method: "POST", body, token, headers, expected })).json();
}
async function settled(id, token, wanted) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const metadata = await json(`documents/${id}`, "GET", undefined, token);
    if (metadata.status !== "PROCESSING") { assert.equal(metadata.status, wanted, `${id}: ${JSON.stringify(metadata)}`); return metadata; }
    await setTimeout(500);
  }
  assert.fail("Processing did not finish within 90 seconds");
}
const token = await account(email);
const other = await account(`other-${randomUUID()}@example.test`);
const subject = await json("subjects", "POST", { name: "Documentos sintéticos fase 2" }, token, 201);
const files = [
  ["academic.pdf", "application/pdf", "page"],
  ["academic.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "section"],
  ["academic.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "slide"],
  ["academic.png", "image/png", "image"], ["academic.jpg", "image/jpeg", "image"], ["academic.jpeg", "image/jpeg", "image"],
];
const uploaded = [];
for (const [name, mime, unit] of files) {
  const bytes = readFileSync(new URL(`../.cache/phase2-fixtures/${name}`, import.meta.url));
  const document = await upload(subject.id, name, bytes, mime, token);
  assert.equal(document.status, "UPLOADED"); assert.equal(document.sizeBytes, bytes.length);
  assert.equal(document.checksum, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(document.gridfsId, undefined);
  await request(core, `documents/${document.documentId}/download`, { token, expected: 409 });
  await json(`documents/${document.documentId}/text`, "GET", undefined, token, 409);
  const operation = randomUUID();
  const process = await json(`documents/${document.documentId}/process`, "POST", {}, token, 202, { "Idempotency-Key": operation });
  assert.equal(process.operationId, operation);
  await settled(document.documentId, token, "READY");
  const download = await request(core, `documents/${document.documentId}/download`, { token });
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  const repeated = await json(`documents/${document.documentId}/process`, "POST", {}, token, 200, { "Idempotency-Key": operation });
  assert.equal(repeated.operationId, operation);
  const text = await json(`documents/${document.documentId}/text`, "GET", undefined, token);
  assert.match(text.text.toLowerCase(), /ciencias/); assert.equal(text.fragments[0].unitType, unit);
  assert.equal(text.text, text.fragments.map(f => f.text).join("\n\n")); uploaded.push(document);
  console.log(`OK original GridFS + extraction + text: ${name}`);
}
const first = uploaded[0];
for (const suffix of ["", "/text", "/download"]) {
  await request(core, `documents/${first.documentId}${suffix}`, { expected: 401 });
  await request(core, `documents/${first.documentId}${suffix}`, { token: other, expected: 403 });
}
await json(`documents/${first.documentId}/process`, "POST", {}, null, 401);
await json(`documents/${first.documentId}/process`, "POST", {}, other, 403);
await json(`subjects/${subject.id}/documents`, "GET", undefined, other, 403);
await json(`subjects/${subject.id}/documents`, "GET", undefined, null, 401);
const bytes = readFileSync(new URL("../.cache/phase2-fixtures/academic.pdf", import.meta.url));
await upload(subject.id, "a.pdf", bytes, "application/pdf", null, 401);
await upload(subject.id, "a.pdf", bytes, "application/pdf", other, 403);
await upload(subject.id, "empty.pdf", Buffer.alloc(0), "application/pdf", token, 400);
await upload(subject.id, "a.doc", bytes, "application/msword", token, 415);
await upload(subject.id, "a.ppt", bytes, "application/vnd.ms-powerpoint", token, 415);
await upload(subject.id, "corrupt.pdf", Buffer.from("%PDF-corrupt"), "application/pdf", token, 422);
await upload(subject.id, "spoof.png", bytes, "image/png", token, 422);
await upload(subject.id, "mime.pdf", bytes, "image/png", token, 415);
const protectedPdf = await upload(subject.id, "protected.pdf", readFileSync(new URL("../.cache/phase2-fixtures/protected.pdf", import.meta.url)), "application/pdf", token);
await json(`documents/${protectedPdf.documentId}/process`, "POST", {}, token, 202);
assert.equal((await settled(protectedPdf.documentId, token, "FAILED")).errorCode, "PASSWORD_PROTECTED");
await request(core, `documents/${protectedPdf.documentId}/download`, { token, expected: 409 });
for (const [name, code] of [["active.pdf", "ACTIVE_CONTENT"], ["unknown-associated.pdf", "ATTACHMENTS_NOT_ALLOWED"], ["broken-structure.pdf", "CORRUPT_DOCUMENT"]]) {
  const quarantined = await upload(subject.id, name, readFileSync(new URL(`../.cache/phase2-fixtures/${name}`, import.meta.url)), "application/pdf", token);
  await json(`documents/${quarantined.documentId}/process`, "POST", {}, token, 202);
  assert.equal((await settled(quarantined.documentId, token, "FAILED")).errorCode, code);
  await request(core, `documents/${quarantined.documentId}/download`, { token, expected: 409 });
  await request(core, `documents/${quarantined.documentId}/text`, { token, expected: 409 });
}
await upload(subject.id, "oversized.pdf", Buffer.alloc(15 * 1024 * 1024 + 1), "application/pdf", token, 413);
const scan = await upload(subject.id, "scanned.pdf", readFileSync(new URL("../.cache/phase2-fixtures/scanned.pdf", import.meta.url)), "application/pdf", token);
await json(`documents/${scan.documentId}/process`, "POST", {}, token, 202);
await settled(scan.documentId, token, "READY");
assert.match((await json(`documents/${scan.documentId}/text`, "GET", undefined, token)).text.toLowerCase(), /ciencias/);

const login = await request(bff, "auth/login", { method: "POST", body: JSON.stringify({ email, password }), headers: { ...browser, "Content-Type": "application/json" } });
const publicAuth = await login.json(); assert.equal(publicAuth.accessToken, undefined);
const cookie = login.headers.getSetCookie().find(c => c.startsWith("siare_session=")).split(";")[0];
const session = { ...browser, Cookie: cookie };
const fileBase = frontend + "/api/files/";
// These synthetic requests diagnose each routing boundary independently of PDF validation.
for (const [base, path, method, expected] of [
  [fileBase, `subjects/${subject.id}/documents`, "GET", 404],
  [bff, `subjects/${subject.id}/documents`, "POST", 404],
  [bff, `subjects/${subject.id}/documents`, "GET", 200],
  [core, `subjects/${subject.id}/documents`, "GET", 200],
]) {
  const response = await request(base, path, { method, expected, token: base === core ? token : undefined,
    headers: base === core ? {} : session });
  if (expected === 404) assert.equal((await response.json()).code, "NOT_FOUND");
  else await response.arrayBuffer();
  console.log(`OK route diagnostic: ${method} ${base}${path}; Origin=${base === core ? "absent" : frontend}; HTTP ${expected}`);
}
if (process.env.SIARE_TEST_PDF) {
  const original = readFileSync(process.env.SIARE_TEST_PDF);
  for (const [base, bearer, headers] of [[core, token, {}], [fileBase, null, session]]) {
    const receipt = await upload(subject.id, "Guia_Estudio_MongoDB_Aggregate_Solucionario.pdf", original, "application/pdf", bearer, 201, base, headers);
    assert.equal(receipt.checksum, createHash("sha256").update(original).digest("hex"));
    await request(core, `documents/${receipt.documentId}/download`, { token, expected: 409 });
    await json(`documents/${receipt.documentId}/process`, "POST", {}, token, 202);
    await settled(receipt.documentId, token, "READY");
    const text = await json(`documents/${receipt.documentId}/text`, "GET", undefined, token);
    assert.equal(text.unitCount, 13); assert.match(text.text.toLowerCase(), /aggregate/);
    assert.ok(text.warnings.includes("PROVENANCE_UNVERIFIED"));
    assert.ok(text.warnings.includes("ASSOCIATED_FILES_IGNORED"));
    assert.deepEqual(Buffer.from(await (await request(core, `documents/${receipt.documentId}/download`, { token })).arrayBuffer()), original);
    await request(core, `documents/${receipt.documentId}/text`, { token: other, expected: 403 });
    console.log(`OK original C2PA: upload -> quarantine -> READY -> 13 pages -> text -> exact GridFS bytes via ${base}`);
  }
}
await upload(subject.id, "bff.pdf", bytes, "application/pdf", null, 403, fileBase, { Cookie: cookie });
await upload(subject.id, "bff.pdf", bytes, "application/pdf", null, 403, fileBase, { ...session, Origin: "https://evil.test" });
const fromBff = await upload(subject.id, "bff.pdf", bytes, "application/pdf", null, 201, fileBase, session);
await json(`documents/${fromBff.documentId}/process`, "POST", {}, token, 202);
await settled(fromBff.documentId, token, "READY");
const bffDownload = await request(fileBase, `documents/${fromBff.documentId}/download`, { headers: { Cookie: cookie } });
assert.deepEqual(Buffer.from(await bffDownload.arrayBuffer()), bytes);
await request(fileBase, `documents/${fromBff.documentId}/download`, { expected: 401 });
await request(bff, "subjects", { method: "POST", headers: { ...session, "Content-Type": "application/json" }, body: JSON.stringify({ name: "a".repeat(17000) }), expected: 413 });
await upload(subject.id, "too-big.pdf", Buffer.alloc(16 * 1024 * 1024), "application/pdf", null, 413, fileBase, session);
const boundary = `siare-${randomUUID()}`;
async function* excessiveMultipart() {
  yield Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="streamed.pdf"\r\nContent-Type: application/pdf\r\n\r\n`);
  for (let index = 0; index < 260; index++) yield Buffer.alloc(65536);
  yield Buffer.from(`\r\n--${boundary}--\r\n`);
}
await request(fileBase, `subjects/${subject.id}/documents`, { method: "POST", body: Readable.from(excessiveMultipart()), duplex: "half",
  headers: { ...session, "Content-Type": `multipart/form-data; boundary=${boundary}` }, expected: 413 });
console.log("OK authorization, invalid uploads, multipart/download BFF and original 16 KiB JSON boundary");

if (process.argv.includes("--outage")) {
  const retryable = await upload(subject.id, "retry.pdf", bytes, "application/pdf", token);
  try {
    compose("stop", "content-ai");
    await json(`documents/${retryable.documentId}/process`, "POST", {}, token, 202);
    const failed = await settled(retryable.documentId, token, "FAILED");
    assert.equal(failed.errorCode, "PROCESSOR_UNAVAILABLE");
    await request(core, `documents/${retryable.documentId}/download`, { token, expected: 409 });
  } finally { compose("start", "--wait", "content-ai"); }
  await json(`documents/${retryable.documentId}/process`, "POST", {}, token, 202);
  await settled(retryable.documentId, token, "READY");
  console.log("OK Python outage, preserved original and successful retry");
}
await json(`subjects/${subject.id}/archive`, "PATCH", {}, token);
await upload(subject.id, "archived.pdf", bytes, "application/pdf", token, 409);
await json(`documents/${first.documentId}/process`, "POST", {}, token, 409);
assert.equal((await json(`subjects/${subject.id}/documents`, "GET", undefined, token)).length >= 8, true);
await json(`documents/${first.documentId}/text`, "GET", undefined, token);
if (process.argv.includes("--restart")) {
  compose("restart"); compose("up", "--detach", "--no-recreate", "--wait", "--wait-timeout", "900");
  const original = await request(core, `documents/${first.documentId}/download`, { token });
  assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
  assert.match((await json(`documents/${first.documentId}/text`, "GET", undefined, token)).text, /ciencias/);
  const sessionDownload = await request(fileBase, `documents/${first.documentId}/download`, { headers: { Cookie: cookie } });
  assert.deepEqual(Buffer.from(await sessionDownload.arrayBuffer()), bytes);
  console.log("OK originals, fragments, metadata, JWT and HttpOnly session survive restart");
}
console.log(`OK ${checks} HTTP checks for Phase 2; synthetic data retained.`);

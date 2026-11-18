import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedUpload, boundedStream, ByteLimitError, uploadError } from "../src/lib/document-policy.ts";
import { isAllowedRoute } from "../src/lib/session-policy.ts";

test("upload policy offers all six extensions and rejects empty, legacy and oversized files", () => {
  for (const extension of ["PDF", "docx", "pptx", "jpg", "jpeg", "png"]) assert.equal(uploadError({ name: `fixture.${extension}`, size: 10 }, 20), null);
  for (const file of [{ name: "a.pdf", size: 0 }, { name: "a.doc", size: 10 }, { name: "a.ppt", size: 10 }, { name: "a.pdf", size: 21 }]) assert.equal(typeof uploadError(file, 20), "string");
});

test("multipart requires same origin, CSRF and a bounded valid boundary", () => {
  const headers = new Headers({ origin: "https://siare.test", "x-siare-csrf": "1", "content-type": "multipart/form-data; boundary=----fixture" });
  assert.equal(allowedUpload(headers, "https://siare.test"), true);
  for (const [key, value] of [["origin", "https://other.test"], ["x-siare-csrf", ""], ["content-type", "application/json"], ["content-type", "multipart/form-data"], ["sec-fetch-site", "cross-site"]]) {
    const altered = new Headers(headers); altered.set(key, value); assert.equal(allowedUpload(altered, "https://siare.test"), false);
  }
});

test("actual streaming bytes are limited even without content-length", async () => {
  function source() { return new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5)); c.enqueue(new Uint8Array(6)); c.close(); } }); }
  assert.equal((await new Response(boundedStream(source(), 11)).arrayBuffer()).byteLength, 11);
  await assert.rejects(new Response(boundedStream(source(), 10)).arrayBuffer(), ByteLimitError);
});

test("JSON proxy allows document JSON operations but leaves upload/download to dedicated routes", () => {
  const id = "00000000-0000-0000-0000-000000000000";
  for (const path of [`subjects/${id}/documents`, `documents/${id}`, `documents/${id}/text`]) assert.equal(isAllowedRoute("GET", path), true);
  assert.equal(isAllowedRoute("POST", `documents/${id}/process`), true);
  assert.equal(isAllowedRoute("POST", `subjects/${id}/documents`), false);
  assert.equal(isAllowedRoute("GET", `documents/${id}/download`), false);
});

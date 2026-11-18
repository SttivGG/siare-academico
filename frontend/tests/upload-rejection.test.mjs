import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedUploadStream, ByteLimitError } from "../src/lib/document-policy.ts";

test("small upload overage is fully consumed before rejection and never forwarded as a successful stream", async () => {
  let chunksRead = 0;
  const source = new ReadableStream({ pull(controller) {
    chunksRead++;
    controller.enqueue(new Uint8Array(2));
    if (chunksRead === 3) controller.close();
  } });
  await assert.rejects(new Response(boundedUploadStream(source, 3, 4)).arrayBuffer(), ByteLimitError);
  assert.equal(chunksRead, 3);
});

test("unbounded upload is cancelled at a finite drain budget", async () => {
  let cancelled = false, read = 0;
  const source = new ReadableStream({ pull(controller) { read++; controller.enqueue(new Uint8Array(2)); }, cancel() { cancelled = true; } });
  await assert.rejects(new Response(boundedUploadStream(source, 3, 4)).arrayBuffer(), ByteLimitError);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, true);
  assert.ok(read <= 6);
});

test("valid upload bytes remain intact", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const source = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  assert.deepEqual(new Uint8Array(await new Response(boundedUploadStream(source, 3)).arrayBuffer()), bytes);
});

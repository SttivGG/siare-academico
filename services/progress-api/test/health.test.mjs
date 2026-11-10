import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

for (const ready of [true, false]) {
  test(`GET /health returns ${ready ? "UP" : "DOWN"} without details`, async () => {
    const server = createApp({ isReady: async () => ready }).listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
      assert.equal(response.status, ready ? 200 : 503);
      assert.deepEqual(await response.json(), { service: "progress-api", status: ready ? "UP" : "DOWN" });
      const denied = await fetch(`http://127.0.0.1:${server.address().port}/health`, { method: "POST" });
      assert.equal(denied.status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

test("unexpected model failure returns a limited error response", async () => {
  const server = createApp({ isReady: async () => { throw new Error("secret"); } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { service: "progress-api", status: "DOWN" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

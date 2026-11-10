import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { checkCoreHealth } from "../src/lib/core-health.ts";

for (const [code, body, expected] of [
  [200, '{"status":"UP"}', "UP"],
  [503, '{"status":"DOWN"}', "DOWN"],
  [200, '{"other":"value"}', "DOWN"],
  [200, "invalid json", "DOWN"],
]) {
  test(`core HTTP ${code} / ${body} maps to ${expected}`, async () => {
    const server = createServer((request, response) => {
      assert.equal(request.url, "/health");
      response.writeHead(code, { "Content-Type": "application/json" }).end(body);
    }).listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      assert.deepEqual(await checkCoreHealth(`http://127.0.0.1:${server.address().port}`), { status: expected });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

test("missing configuration and invalid URL cannot report UP", async () => {
  assert.deepEqual(await checkCoreHealth(undefined), { status: "DOWN" });
  assert.deepEqual(await checkCoreHealth("invalid-url"), { status: "DOWN" });
});

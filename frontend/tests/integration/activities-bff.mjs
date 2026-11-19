import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// Real production Next handler with an isolated, recording HTTP upstream.
const id = '678e45e5-10d2-4c9d-b13b-923418257748';
let app, upstream, origin, last, count = 0;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
before(async () => {
  upstream = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    last = { url: req.url, method: req.method, authorization: req.headers.authorization, body }; count++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url === '/api/v1/auth/refresh' ? { accessToken: 'renewed', refreshToken: 'renewal', expiresAt: new Date(Date.now() + 300000).toISOString(), refreshExpiresAt: new Date(Date.now() + 600000).toISOString() } : { items: [], nextCursor: null }));
  });
  const upstreamPort = await listen(upstream), reservation = createServer(), port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve)); origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, APP_ORIGIN: origin, CORE_API_URL: `http://127.0.0.1:${upstreamPort}`, SESSION_COOKIE_SECURE: 'false', NEXT_TELEMETRY_DISABLED: '1' },
  });
  let diagnostics = ''; app.stderr.on('data', chunk => { diagnostics += chunk; });
  for (let i = 0; i < 100; i++) { try { await fetch(origin + '/login'); return; } catch {} await delay(200); }
  throw new Error(`Next did not start: ${diagnostics}`);
});
after(async () => { app?.kill(); if (upstream) await new Promise(resolve => upstream.close(resolve)); });
const headers = () => ({ Origin: origin, 'X-SIARE-CSRF': '1', 'Content-Type': 'application/json', Cookie: 'siare_session=controlled' });
const request = (path, method = 'GET', body, extra = {}) => fetch(`${origin}/api/bff/${path}`, { method, headers: { ...headers(), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
test('five actual routes forward authorization and cursor; unknown routes stay closed', async () => {
  for (const [method, path, body] of [['GET', `subjects/${id}/activities?limit=2&cursor=${id}`], ['POST', `subjects/${id}/activities`, { bank: {} }], ['GET', `activities/${id}`], ['POST', `activities/${id}/submissions`, { idempotencyKey: id, answers: {}, durationMs: 0 }], ['GET', `activities/${id}/submissions/${id}`]]) {
    assert.equal((await request(path, method, body)).status, 200); assert.equal(last.authorization, 'Bearer controlled');
    assert.equal(last.url, `/api/v1/${path}`);
  }
  const before = count;
  assert.equal((await request(`activities/${id}/submissions`)).status, 404);
  assert.equal((await request(`activities/${id}/answer-key`)).status, 404);
  assert.equal((await request(`activities/${id}`, 'DELETE', {})).status, 404);
  assert.equal(count, before);
});
test('malformed pagination, absent session and CSRF never reach upstream', async () => {
  const before = count;
  for (const query of ['cursor=invalid', 'limit=101', 'limit=0']) assert.equal((await request(`subjects/${id}/activities?${query}`)).status, 400);
  assert.equal((await request(`activities/${id}`, 'GET', undefined, { Cookie: '' })).status, 401);
  assert.equal((await request(`activities/${id}/submissions`, 'POST', {}, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request(`subjects/${id}/activities`, 'POST', {}, { 'X-SIARE-CSRF': '' })).status, 403);
  assert.equal(count, before);
});
test('banks over 16 KiB pass intact; byte limits stay scoped even without content-length', async () => {
  const bank = { bank: { questions: [{ prompt: 'á'.repeat(20000) }] } };
  assert.equal((await request(`subjects/${id}/activities`, 'POST', bank)).status, 200);
  assert.equal(last.body, JSON.stringify(bank));
  assert.equal((await request('auth/login', 'POST', bank)).status, 413);
  assert.equal((await request(`activities/${id}/submissions`, 'POST', { x: 'x'.repeat(65536) })).status, 413);
  const response = await fetch(`${origin}/api/bff/subjects/${id}/activities`, { method: 'POST', headers: headers(), duplex: 'half', body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(' '.repeat(4 * 1024 * 1024 + 1))); controller.close(); } }) });
  assert.equal(response.status, 413);
});
test('retry payloads are forwarded unchanged; refresh keeps HttpOnly session boundaries', async () => {
  const body = { idempotencyKey: id, answers: { q1: 'a' }, durationMs: 123 };
  await request(`activities/${id}/submissions`, 'POST', body); const first = last.body;
  await request(`activities/${id}/submissions`, 'POST', body); assert.equal(last.body, first);
  const response = await request('auth/refresh', 'POST', {}, { Cookie: 'siare_refresh=refresh-secret' });
  assert.equal(response.status, 200); assert.equal(last.body, JSON.stringify({ refreshToken: 'refresh-secret' }));
  const cookies = response.headers.getSetCookie().join(';'); assert.match(cookies, /HttpOnly/); assert.match(cookies, /SameSite=Strict/i);
  assert.doesNotMatch(JSON.stringify(await response.json()), /renewed|renewal|refresh-secret/);
});

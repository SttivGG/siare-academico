import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { AcademicController, sourceKey } from '../src/lib/academic-state.ts';
import { decryptRecovery, deriveRecoveryKey, encryptRecovery, MAX_AGE, recoverySnapshot, restoreSnapshot } from '../src/lib/academic-recovery.ts';

const fixture = name => readFile(new URL(`./fixtures/h3/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const phrase = 'Frase local sintética de recuperación';
async function setup() { const quiz = await fixture('quiz'); const controller = new AcademicController(user, quiz.subjectId); controller.open(quiz); return { controller, quiz }; }

test('ST-01/02: bank drafts belong to a source and preserve content while provenance invalidates review', async () => {
  const { controller } = await setup();
  controller.draft('external', { raw: '{"manual":"privado"}', topic: 'Uno', reviewed: true }, false);
  controller.show('catalog'); controller.show('bank');
  assert.equal(controller.getSnapshot().drafts.external.raw, '{"manual":"privado"}');
  const source = { documentId: crypto.randomUUID(), originalFilename: 'fuente.pdf' };
  controller.selectSource(source); controller.draft(sourceKey(source), { raw: '{"otra":"fuente"}' });
  controller.selectSource(null);
  assert.equal(controller.getSnapshot().drafts.external.raw, '{"manual":"privado"}');
  assert.equal(controller.getSnapshot().drafts.external.reviewed, false);
  assert.equal(controller.getSnapshot().drafts[source.documentId].raw, '{"otra":"fuente"}');
});
test('ST-03/04/05: independent activity state survives presentation and activity changes', async () => {
  const { controller, quiz } = await setup(), crossword = { ...await fixture('crossword'), subjectId: quiz.subjectId };
  controller.attempt(quiz.activityId, { answers: { q1: 'a' }, index: 1 });
  const startedAt = controller.getSnapshot().attempts[quiz.activityId].startedAt;
  controller.show('bank'); controller.update({ panel: 'sources' }); controller.open(crossword);
  controller.attempt(crossword.activityId, { cells: { '0:0': 'S' }, direction: 'DOWN' }); controller.open(quiz);
  assert.deepEqual(controller.getSnapshot().attempts[quiz.activityId].answers, { q1: 'a' });
  assert.equal(controller.getSnapshot().attempts[quiz.activityId].startedAt, startedAt);
  assert.equal(controller.getSnapshot().attempts[quiz.activityId].index, 1);
  assert.equal(controller.getSnapshot().attempts[crossword.activityId].direction, 'DOWN');
  assert.deepEqual(controller.getSnapshot().attempts[crossword.activityId].answers, {});
});
test('ST-06/07: synchronous lock, lost response and late evaluation retain one exact envelope and original owner', async () => {
  const { controller, quiz } = await setup(); let release;
  const bodies = []; const result = { ...await fixture('result'), activityId: quiz.activityId, subjectId: quiz.subjectId };
  controller.attempt(quiz.activityId, { answers: { q1: 'a' } });
  const send = body => { bodies.push(JSON.stringify(body)); return new Promise(resolve => { release = resolve; }); };
  const first = controller.submit(quiz.activityId, send);
  await controller.submit(quiz.activityId, send);
  await Promise.resolve(); assert.equal(bodies.length, 1);
  const secondActivity = { ...quiz, activityId: crypto.randomUUID() }; controller.open(secondActivity);
  release(result); await first;
  assert.equal(controller.getSnapshot().selectedActivity, secondActivity.activityId);
  assert.equal(controller.getSnapshot().attempts[secondActivity.activityId].result, null);
  assert.equal(controller.getSnapshot().attempts[quiz.activityId].result, result);
  controller.restart(quiz.activityId); controller.attempt(quiz.activityId, { answers: { q1: 'a' } });
  await controller.submit(quiz.activityId, async body => { bodies.push(JSON.stringify(body)); throw Error('respuesta perdida'); });
  const frozen = controller.getSnapshot().attempts[quiz.activityId].frozen;
  controller.attempt(quiz.activityId, { index: 1 });
  assert.equal(controller.getSnapshot().attempts[quiz.activityId].index, 1, 'a pending envelope still permits reading another question');
  assert.deepEqual(controller.getSnapshot().attempts[quiz.activityId].frozen, frozen);
  controller.attempt(quiz.activityId, { answers: { q1: 'b' } }); controller.show('bank');
  await controller.submit(quiz.activityId, async body => { bodies.push(JSON.stringify(body)); return result; });
  assert.equal(bodies[1], bodies[2]); assert.equal(JSON.parse(bodies[2]).idempotencyKey, frozen.idempotencyKey);
});
test('ST-09: encrypted allowlist, unique IV, wrong phrase, tampering, expiry and account binding', async () => {
  const { controller, quiz } = await setup();
  controller.draft('external', { raw: '{"soluciones":"solo del autor"}', topic: 'Privado' });
  controller.attempt(quiz.activityId, { answers: { q1: 'a' } });
  const salt = [...crypto.getRandomValues(new Uint8Array(16))], key = await deriveRecoveryKey(phrase, new Uint8Array(salt));
  const base = await encryptRecovery(controller.getSnapshot(), user, quiz.subjectId, key, salt);
  const record = { ...base, revision: 1, owner: 'tab', leaseUntil: 0 };
  const next = await encryptRecovery(controller.getSnapshot(), user, quiz.subjectId, key, salt);
  assert.notDeepEqual(record.iv, next.iv); assert.equal(key.extractable, false);
  assert.equal(record.expiresAt, next.expiresAt, 'reading or rewriting a copy cannot extend retention');
  assert.doesNotMatch(new TextDecoder().decode(record.ciphertext), /soluciones|Privado|correctOptionId/);
  const { snapshot } = await decryptRecovery(record, phrase, user, quiz.subjectId);
  assert.equal(restoreSnapshot(snapshot, [], [quiz]).editedAt, controller.getSnapshot().editedAt);
  assert.equal(restoreSnapshot(snapshot, [], [quiz]).drafts.external.raw, '{"soluciones":"solo del autor"}');
  await assert.rejects(decryptRecovery(record, 'Una frase incorrecta', user, quiz.subjectId), /Frase incorrecta/);
  await assert.rejects(decryptRecovery(record, phrase, crypto.randomUUID(), quiz.subjectId), /no pertenece/);
  await assert.rejects(decryptRecovery({ ...record, activities: [] }, phrase, user, quiz.subjectId), /Frase incorrecta/);
  await assert.rejects(decryptRecovery({ ...record, expiresAt: Date.now() - 1 }, phrase, user, quiz.subjectId), /caducado/);
  await assert.rejects(decryptRecovery({ ...record, expiresAt: record.updatedAt + MAX_AGE + 1 }, phrase, user, quiz.subjectId), /fechas/);
  await assert.rejects(decryptRecovery({ ...record, version: 0 }, phrase, user, quiz.subjectId), /versión/);
  assert.throws(() => restoreSnapshot(snapshot, [], []), /inválido/);
});
test('ST-09: a recovered frozen envelope remains unresolved until an explicit retry', async () => {
  const { controller, quiz } = await setup();
  await controller.submit(quiz.activityId, async () => { throw Error('lost'); });
  const snapshot = recoverySnapshot(controller.getSnapshot());
  const restored = restoreSnapshot(snapshot, [], [quiz]);
  assert.equal(restored.attempts[quiz.activityId].status, 'unresolved');
  assert.deepEqual(restored.attempts[quiz.activityId].frozen, controller.getSnapshot().attempts[quiz.activityId].frozen);
  assert.doesNotMatch(JSON.stringify(snapshot), /expected|rationale|content|originalFilename|correctOptionId/);
});
test('confirmed attempts persist only a receipt; feedback is fetched and authorized again', async () => {
  const { controller, quiz } = await setup();
  const result = { ...await fixture('result'), subjectId: quiz.subjectId, activityId: quiz.activityId };
  await controller.submit(quiz.activityId, async () => result);
  const snapshot = recoverySnapshot(controller.getSnapshot());
  assert.equal(snapshot.receipts[quiz.activityId], result.attemptId);
  assert.equal(snapshot.attempts[quiz.activityId], undefined);
  assert.doesNotMatch(JSON.stringify(snapshot), /expected|rationale|feedback|frozen/);
  assert.throws(() => restoreSnapshot(snapshot, [], [quiz]), /inválido/);
  const restored = restoreSnapshot(snapshot, [], [quiz], [result]);
  assert.equal(restored.attempts[quiz.activityId].status, 'received');
  assert.equal(restored.attempts[quiz.activityId].result.attemptId, result.attemptId);
});
test('ST-10: destroying an authenticated controller drops work and ignores a late response', async () => {
  const { controller, quiz } = await setup(); let release;
  const request = controller.submit(quiz.activityId, () => new Promise(resolve => { release = resolve; }));
  await Promise.resolve(); controller.destroy(); release({ activityId: quiz.activityId, subjectId: quiz.subjectId }); await request;
  assert.deepEqual(controller.getSnapshot().attempts, {});
});

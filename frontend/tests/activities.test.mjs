import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBank, validateGeneration, normalize, crosswordAnswers, freezeSubmission } from '../src/lib/activities.ts';
import { activityRoute, activityQuery, bodyLimit } from '../src/lib/activity-policy.ts';

const subject = '678e45e5-10d2-4c9d-b13b-923418257748';
const source = { reference: 'Página 1', fragmentIndex: 0, quote: 'La respuesta es cuatro.' };
const question = { id: 'q1', prompt: 'Dos más dos', options: [{ id: 'a', text: 'cuatro' }, { id: 'b', text: 'cinco' }], correctOptionId: 'a', explanation: 'Suma revisada.', topic: 'Repaso', source };
const draft = () => ({ validated: true, questions: [structuredClone(question)], words: [] });
test('only the five authorized H3 routes and methods are admitted', () => {
  for (const [method, path] of [['POST', `subjects/${subject}/activities`], ['GET', `subjects/${subject}/activities`], ['GET', `activities/${subject}`], ['POST', `activities/${subject}/submissions`], ['GET', `activities/${subject}/submissions/${subject}`]]) assert.equal(activityRoute(method, path), true);
  for (const [method, path] of [['GET', `activities/${subject}/submissions`], ['DELETE', `activities/${subject}`], ['PATCH', `subjects/${subject}/activities`], ['POST', 'activities/../../admin'], ['GET', `activities/${'-'.repeat(36)}`], ['GET', `activities/${subject}/answer-key`]]) assert.equal(activityRoute(method, path), false);
});
test('cursor is validated and large bank limits do not affect auth or submissions', () => {
  const path = `subjects/${subject}/activities`;
  assert.equal(activityQuery(path, new URLSearchParams({ limit: '20', cursor: subject })).get('cursor'), subject);
  for (const query of [{ limit: '0' }, { limit: '101' }, { cursor: 'not-a-uuid' }]) assert.equal(activityQuery(path, new URLSearchParams(query)), null);
  assert.equal(bodyLimit('POST', path), 4 * 1024 * 1024);
  assert.equal(bodyLimit('POST', `activities/${subject}/submissions`), 64 * 1024);
  assert.equal(bodyLimit('POST', 'auth/login'), 16_384);
});
test('importing validated:true still requires a separate review; factual claims stay editorial', () => {
  const bank = parseBank(JSON.stringify(draft())); assert.equal(bank.validated, false);
  validateGeneration(bank, 'QUIZ', 'Repaso', 1, 15, [{ index: 0, text: source.quote }]);
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Otro', 1, 15), /insuficiente/);
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Repaso', 2, 15), /insuficiente/);
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Repaso', 1, 26), /Cuadrícula/);
});
test('invalid bank structures, duplicates, answer keys and oversize fields are rejected', () => {
  const mutations = [b => b.questions.push(b.questions[0]), b => b.questions[0].options[1].id = 'a', b => b.questions[0].options[1].text = 'CUATRO', b => b.questions[0].correctOptionId = 'unknown', b => b.questions[0].prompt = 'x'.repeat(2001), b => b.questions[0].source.fragmentIndex = 2000, b => b.score = 1, b => b.questions[0].unknown = true, b => b.words = [{ id: 'w', answer: '12', clue: 'c', topic: 'Repaso' }], b => b.questions = Array(51).fill(question)];
  for (const mutate of mutations) { const bank = draft(); mutate(bank); assert.throws(() => parseBank(JSON.stringify(bank))); }
});
test('document evidence must reference a real fragment, literal quote, and correct answer', () => {
  const bank = parseBank(JSON.stringify(draft()));
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Repaso', 1, 15, []), /cita literal/);
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Repaso', 1, 15, [{ index: 0, text: 'Texto diferente' }]), /cita literal/);
  bank.questions[0].source.quote = 'La respuesta';
  assert.throws(() => validateGeneration(bank, 'QUIZ', 'Repaso', 1, 15, [{ index: 0, text: source.quote }]), /cita literal/);
});
test('Spanish normalization preserves Ñ, crossword intersections share one cell', () => {
  assert.equal(normalize(' cañón - niño '), 'CAÑONNIÑO'); assert.notEqual(normalize('ano'), normalize('año'));
  const clues = [{ id: 'w1', row: 0, column: 0, direction: 'DOWN', length: 3 }, { id: 'w2', row: 2, column: 0, direction: 'ACROSS', length: 4 }];
  assert.deepEqual(crosswordAnswers(clues, { '0:0': 'S', '1:0': 'O', '2:0': 'L', '2:1': 'U', '2:2': 'N', '2:3': 'A' }), { w1: 'SOL', w2: 'LUNA' });
  assert.deepEqual(crosswordAnswers(clues, { '0:0': 'S' }), {});
});
test('submission snapshots exclude score and cannot change when answer state is edited', () => {
  const answers = { q1: 'a' }, envelope = freezeSubmission(answers, Date.now() - 10);
  answers.q1 = 'b'; assert.equal(envelope.answers.q1, 'a');
  assert.match(envelope.idempotencyKey, /^[a-f0-9-]{36}$/); assert.ok(envelope.durationMs >= 0);
  assert.deepEqual(Object.keys(envelope).sort(), ['answers', 'durationMs', 'idempotencyKey']);
});

export type Source = { reference: string; fragmentIndex?: number | null; quote?: string | null };
export type Option = { id: string; text: string };
export type Question = { id: string; prompt: string; options: Option[]; correctOptionId: string; topic: string; explanation: string; source?: Source | null };
export type Word = { id: string; answer: string; clue: string; topic: string; source?: Source | null };
export type Bank = { validated: boolean; questions: Question[]; words: Word[] };
export type Fragment = { index: number; unitType: string; unitNumber: number; text: string };
export type DocumentSource = { documentId: string; originalFilename: string };
export type ActivityType = 'QUIZ' | 'CROSSWORD';
// Catalog H3 deliberately does not include dates or document metadata.
export type ActivitySummary = { activityId: string; subjectId: string; type: ActivityType; title: string; available: boolean };
export type ActivityDetail = Omit<ActivitySummary, 'available'> & { documentId: string | null; status: string; createdAt: string };
export type Clue = { id: string; number: number; row: number; column: number; direction: 'ACROSS' | 'DOWN'; length: number; clue: string; source?: Source | null };
export type QuizActivity = ActivityDetail & { type: 'QUIZ'; content: { questions: Omit<Question, 'correctOptionId' | 'explanation'>[] } };
export type CrosswordActivity = ActivityDetail & { type: 'CROSSWORD'; content: { rows: number; columns: number; cells: { row: number; column: number }[]; clues: Clue[] } };
export type Activity = QuizActivity | CrosswordActivity;
export type Evaluation = { attemptId: string; activityId: string; subjectId: string; activityType: ActivityType; percentage: number; points: number; total: number; occurredAt: string; feedback: string; items: { id: string; correct: boolean; submitted: string | null; expected: string; rationale: string; feedback: string }[] };
export type Submission = { idempotencyKey: string; answers: Record<string, string>; durationMs: number };
export function normalize(value: string) {
  return value.trim().normalize('NFC').toUpperCase().replaceAll('Ñ', '\uE000').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('\uE000', 'Ñ').replace(/[\s-]/g, '');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Se esperaba un objeto.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('El banco contiene campos desconocidos. Consulta el formato H3.');
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}: texto obligatorio, máximo ${max} caracteres.`);
  return value.trim();
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('ID inválido: usa 1–64 letras, números, guion o guion bajo.');
  return value;
}
function unique(values: string[], label: string) { if (new Set(values).size !== values.length) throw new Error(`${label}: hay valores repetidos.`); }
function source(value: unknown): Source | null {
  if (value == null) return null;
  const s = object(value); keys(s, ['reference', 'fragmentIndex', 'quote']);
  if (s.fragmentIndex != null && (!Number.isInteger(s.fragmentIndex) || Number(s.fragmentIndex) < 0 || Number(s.fragmentIndex) > 1999)) throw new Error('Índice de fragmento inválido (0–1999).');
  return { reference: text(s.reference, 500, 'Referencia'), fragmentIndex: s.fragmentIndex as number | null | undefined,
    quote: s.quote == null ? null : text(s.quote, 4000, 'Cita') };
}
// Editorial draft may have validated:false; only explicit student review sets true at publication.
export function parseBank(raw: string): Bank {
  const b = object(JSON.parse(raw)); keys(b, ['validated', 'questions', 'words']);
  if (typeof b.validated !== 'boolean') throw new Error('validated debe ser booleano; confirma la revisión antes de publicar.');
  if (b.questions != null && !Array.isArray(b.questions) || b.words != null && !Array.isArray(b.words)) throw new Error('questions y words deben ser listas.');
  const qs = (b.questions ?? []) as unknown[]; const ws = (b.words ?? []) as unknown[];
  if (qs.length > 50 || ws.length > 12) throw new Error('Máximo 50 preguntas y 12 palabras.');
  const questions = qs.map(value => {
    const q = object(value); keys(q, ['id', 'prompt', 'options', 'correctOptionId', 'topic', 'source', 'explanation']);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error('Cada pregunta necesita de 2 a 6 opciones.');
    const options = q.options.map(value => { const o = object(value); keys(o, ['id', 'text']); return { id: id(o.id), text: text(o.text, 1000, 'Opción') }; });
    unique(options.map(o => o.id), 'IDs de opciones'); unique(options.map(o => o.text.toLowerCase()), 'Textos de opciones');
    const correctOptionId = id(q.correctOptionId);
    if (!options.some(o => o.id === correctOptionId)) throw new Error('La respuesta correcta debe identificar una opción existente.');
    return { id: id(q.id), prompt: text(q.prompt, 2000, 'Pregunta'), topic: text(q.topic, 100, 'Tema'), explanation: text(q.explanation, 2000, 'Justificación'), options, correctOptionId, source: source(q.source) };
  });
  const words = ws.map(value => {
    const w = object(value); keys(w, ['id', 'answer', 'clue', 'topic', 'source']);
    const answer = normalize(text(w.answer, 100, 'Palabra'));
    if (!/^[A-ZÑ]{2,25}$/.test(answer)) throw new Error('Las palabras deben tener de 2 a 25 letras españolas.');
    return { id: id(w.id), answer, clue: text(w.clue, 2000, 'Pista'), topic: text(w.topic, 100, 'Tema'), source: source(w.source) };
  });
  unique(questions.map(q => q.id), 'Preguntas'); unique(words.map(w => w.id), 'Palabras'); unique(words.map(w => w.answer), 'Respuestas');
  return { validated: false, questions, words };
}
export function validateGeneration(bank: Bank, type: ActivityType, topic: string, count: number, gridSize: number, fragments?: Fragment[]) {
  text(topic, 100, 'Tema');
  const entries = type === 'QUIZ' ? bank.questions : bank.words;
  const min = type === 'QUIZ' ? 1 : 2, max = type === 'QUIZ' ? 50 : 12;
  if (!Number.isInteger(count) || count < min || count > max) throw new Error(`Cantidad: de ${min} a ${max}.`);
  if (!Number.isInteger(gridSize) || gridSize < 5 || gridSize > 25) throw new Error('Cuadrícula: de 5 a 25.');
  if (entries.filter(e => e.topic === topic).length < count) throw new Error('Contenido insuficiente para la cantidad y el tema exacto seleccionados.');
  if (fragments) for (const entry of [...bank.questions, ...bank.words]) {
    const s = entry.source; const fragment = fragments.find(f => f.index === s?.fragmentIndex);
    const answer = 'answer' in entry ? entry.answer : entry.options.find(o => o.id === entry.correctOptionId)!.text;
    if (!s?.reference || !s.quote || !fragment?.text.includes(s.quote) || !normalize(s.quote).includes(normalize(answer)))
      throw new Error(`${entry.id}: indica una cita literal del fragmento que contenga la respuesta correcta.`);
  }
}
export function clueCells(clue: Clue) {
  return Array.from({ length: clue.length }, (_, i) => `${clue.row + (clue.direction === 'DOWN' ? i : 0)}:${clue.column + (clue.direction === 'ACROSS' ? i : 0)}`);
}
export function crosswordAnswers(clues: Clue[], cells: Record<string, string>) {
  return Object.fromEntries(clues.flatMap(clue => {
    const letters = clueCells(clue).map(key => cells[key] ?? '');
    return letters.every(Boolean) ? [[clue.id, letters.join('')]] : [];
  }));
}
export function freezeSubmission(answers: Record<string, string>, startedAt: number): Submission {
  return { idempotencyKey: crypto.randomUUID(), answers: { ...answers }, durationMs: Math.min(86_400_000, Math.max(0, Date.now() - startedAt)) };
}

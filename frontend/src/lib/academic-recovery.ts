import { newAcademicState, newAttempt, newDraft, type AcademicState } from './academic-state.ts';
import { parseBank, validateGeneration, type Activity, type DocumentSource, type Evaluation } from './activities.ts';

export const RECOVERY_VERSION = 1;
export const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const ITERATIONS = 600_000;
export const RECOVERY_DB = 'siare-academic-recovery';
const MAX_BYTES = 8 * 1024 * 1024;
type Binding = { version: number; userId: string; subjectId: string; sources: string[]; activities: string[]; updatedAt: number; expiresAt: number; consent: true; salt: number[]; iterations: number };
export type RecoveryRecord = Binding & { id: string; iv: number[]; ciphertext: ArrayBuffer; revision: number; owner: string; leaseUntil: number };
type Snapshot = { version: number; editedAt: number; sourceId: string | null; panel: AcademicState['panel']; tool: AcademicState['tool']; selectedActivity: string | null; receipts: Record<string, string>; drafts: Record<string, Pick<ReturnType<typeof newDraft>, 'raw' | 'topic' | 'type' | 'count' | 'gridSize' | 'reviewed' | 'sourceFingerprint'>>; attempts: Record<string, Pick<ReturnType<typeof newAttempt>, 'answers' | 'cells' | 'index' | 'direction' | 'startedAt' | 'frozen'>> };
const recordId = (userId: string, subjectId: string) => `${userId}/${subjectId}`;
const encoder = new TextEncoder();
function binding(r: Binding): Binding { return { version: r.version, userId: r.userId, subjectId: r.subjectId, sources: r.sources, activities: r.activities, updatedAt: r.updatedAt, expiresAt: r.expiresAt, consent: r.consent, salt: r.salt, iterations: r.iterations }; }
function aad(record: Binding) { return encoder.encode(JSON.stringify(binding(record))); }
export async function deriveRecoveryKey(phrase: string, salt: Uint8Array<ArrayBuffer>) {
  if (phrase.length < 12 || phrase.length > 512) throw new Error('Usa una frase local de 12 a 512 caracteres, distinta de tu contraseña SIARE.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** Explicit allowlist: no API objects, documents, results, credentials or keys. */
export function recoverySnapshot(state: AcademicState): Snapshot {
  return { version: RECOVERY_VERSION, editedAt: state.editedAt, sourceId: state.source?.documentId ?? null, panel: state.panel, tool: state.tool, selectedActivity: state.selectedActivity,
    receipts: Object.fromEntries(Object.entries(state.attempts).filter(([, a]) => a.status === 'received' && a.result).map(([id, a]) => [id, a.result!.attemptId])),
    drafts: Object.fromEntries(Object.entries(state.drafts).filter(([, d]) => d.dirty).map(([id, d]) => [id, { raw: d.raw, topic: d.topic, type: d.type, count: d.count, gridSize: d.gridSize, reviewed: d.reviewed, sourceFingerprint: d.sourceFingerprint }])),
    attempts: Object.fromEntries(Object.entries(state.attempts).filter(([, a]) => a.status !== 'received').map(([id, a]) => [id, { answers: { ...a.answers }, cells: { ...a.cells }, index: a.index, direction: a.direction, startedAt: a.startedAt, frozen: a.frozen ? { idempotencyKey: a.frozen.idempotencyKey, answers: { ...a.frozen.answers }, durationMs: a.frozen.durationMs } : null }])) };
}
export async function encryptRecovery(state: AcademicState, userId: string, subjectId: string, key: CryptoKey, salt: number[]): Promise<Omit<RecoveryRecord, 'revision' | 'owner' | 'leaseUntil'>> {
  const snapshot = recoverySnapshot(state), plaintext = encoder.encode(JSON.stringify(snapshot));
  if (plaintext.byteLength > MAX_BYTES) throw new Error('La copia supera 8 MiB. El trabajo sigue en memoria.');
  const now = state.editedAt, metadata: Binding = { version: RECOVERY_VERSION, userId, subjectId, sources: [...new Set([...Object.keys(snapshot.drafts).filter(id => id !== 'external'), ...(snapshot.sourceId ? [snapshot.sourceId] : [])])].sort(), activities: [...new Set([...Object.keys(snapshot.attempts), ...Object.keys(snapshot.receipts), ...(snapshot.selectedActivity ? [snapshot.selectedActivity] : [])])].sort(), updatedAt: now, expiresAt: now + MAX_AGE, consent: true, salt, iterations: ITERATIONS };
  if (now + MAX_AGE <= Date.now()) throw new Error('El trabajo supera siete días desde su última edición. Conservamos la memoria; edita para crear una copia vigente.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(metadata), tagLength: 128 }, key, plaintext);
  return { ...metadata, id: recordId(userId, subjectId), iv: [...iv], ciphertext };
}
function checkRecord(record: RecoveryRecord, userId: string, subjectId: string) {
  if (record.version !== RECOVERY_VERSION) throw new Error('La copia usa una versión anterior o incompatible. Puedes descartarla; no se sobrescribirá.');
  if (record.userId !== userId || record.subjectId !== subjectId || record.id !== recordId(userId, subjectId) || !record.consent) throw new Error('La copia no pertenece a esta sesión y materia.');
  if (!Number.isFinite(record.updatedAt) || record.updatedAt > Date.now() || record.expiresAt <= Date.now() || record.expiresAt > record.updatedAt + MAX_AGE) throw new Error('La copia ha caducado o sus fechas son inválidas.');
  if (record.iterations !== ITERATIONS || !Array.isArray(record.salt) || record.salt.length !== 16 || !Array.isArray(record.iv) || record.iv.length !== 12 || !(record.ciphertext instanceof ArrayBuffer) || record.ciphertext.byteLength > MAX_BYTES + 16) throw new Error('La copia está dañada. El trabajo actual sigue en memoria.');
}
export async function decryptRecovery(record: RecoveryRecord, phrase: string, userId: string, subjectId: string): Promise<{ snapshot: Snapshot; key: CryptoKey }> {
  checkRecord(record, userId, subjectId);
  const key = await deriveRecoveryKey(phrase, new Uint8Array(record.salt));
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(record.iv), additionalData: aad(record), tagLength: 128 }, key, record.ciphertext);
    const snapshot: Snapshot = JSON.parse(new TextDecoder().decode(plaintext));
    validateSnapshot(snapshot);
    const sources = [...new Set([...Object.keys(snapshot.drafts).filter(id => id !== 'external'), ...(snapshot.sourceId ? [snapshot.sourceId] : [])])].sort();
    const activities = [...new Set([...Object.keys(snapshot.attempts), ...Object.keys(snapshot.receipts), ...(snapshot.selectedActivity ? [snapshot.selectedActivity] : [])])].sort();
    if (JSON.stringify(sources) !== JSON.stringify(record.sources) || JSON.stringify(activities) !== JSON.stringify(record.activities)) throw Error();
    return { snapshot, key };
  } catch { throw new Error('Frase incorrecta o copia dañada. Conservamos el trabajo que siga en memoria.'); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireValue(condition: unknown): asserts condition { if (!condition) throw new Error('Formato de recuperación inválido.'); }
function strings(value: unknown, max: number) { requireValue(!!value && typeof value === 'object' && !Array.isArray(value)); requireValue(Object.entries(value).length <= 625 && Object.entries(value).every(([k, v]) => k.length <= 64 && typeof v === 'string' && v.length <= max)); }
function validateSnapshot(s: Snapshot) {
  requireValue(s && s.version === RECOVERY_VERSION && Number.isFinite(s.editedAt) && s.editedAt <= Date.now() && s.editedAt + MAX_AGE > Date.now() && ['sources', 'learning', 'study'].includes(s.panel) && ['reading', 'catalog', 'bank', 'attempt'].includes(s.tool));
  requireValue(s.sourceId === null || uuid.test(s.sourceId)); requireValue(s.selectedActivity === null || uuid.test(s.selectedActivity));
  requireValue(s.receipts && typeof s.receipts === 'object' && !Array.isArray(s.receipts) && Object.keys(s.receipts).length <= 100 && Object.entries(s.receipts).every(([id, attempt]) => uuid.test(id) && typeof attempt === 'string' && uuid.test(attempt)));
  requireValue(s.drafts && typeof s.drafts === 'object' && !Array.isArray(s.drafts) && Object.keys(s.drafts).length <= 100);
  for (const [id, d] of Object.entries(s.drafts)) {
    requireValue((id === 'external' || uuid.test(id)) && d && typeof d.raw === 'string' && d.raw.length <= 4 * 1024 * 1024 && typeof d.topic === 'string' && d.topic.length <= 100 && ['QUIZ', 'CROSSWORD'].includes(d.type));
    requireValue(Number.isFinite(d.count) && Number.isFinite(d.gridSize) && typeof d.reviewed === 'boolean' && (d.sourceFingerprint === null || typeof d.sourceFingerprint === 'string'));
  }
  requireValue(s.attempts && typeof s.attempts === 'object' && !Array.isArray(s.attempts) && Object.keys(s.attempts).length <= 100);
  for (const [id, a] of Object.entries(s.attempts)) {
    requireValue(uuid.test(id) && a && ['ACROSS', 'DOWN'].includes(a.direction) && Number.isInteger(a.index) && a.index >= 0 && Number.isFinite(a.startedAt) && a.startedAt <= Date.now()); strings(a.answers, 64); strings(a.cells, 1);
    if (a.frozen) { requireValue(uuid.test(a.frozen.idempotencyKey) && Number.isInteger(a.frozen.durationMs) && a.frozen.durationMs >= 0 && a.frozen.durationMs <= 86_400_000); strings(a.frozen.answers, 64); }
  }
}
/** Server-authorized resources are supplied fresh after authentication, never from disk. */
export function restoreSnapshot(snapshot: Snapshot, documents: DocumentSource[], activities: Activity[], evaluations: Evaluation[] = []): AcademicState {
  validateSnapshot(snapshot);
  const state = newAcademicState();
  const documentIds = new Set(documents.map(d => d.documentId));
  for (const id of Object.keys(snapshot.drafts)) if (id !== 'external') requireValue(documentIds.has(id));
  if (snapshot.sourceId) requireValue(documentIds.has(snapshot.sourceId));
  state.source = documents.find(d => d.documentId === snapshot.sourceId) ?? null;
  state.editedAt = snapshot.editedAt; state.tool = snapshot.tool; state.panel = snapshot.panel; state.selectedActivity = snapshot.selectedActivity;
  for (const [id, d] of Object.entries(snapshot.drafts)) {
    let bank = null;
    try { bank = parseBank(d.raw); validateGeneration(bank, d.type, d.topic.trim(), d.count, d.gridSize); } catch { bank = null; /* Keep incomplete raw drafts; they are deliberately editable. */ }
    state.drafts[id] = { ...newDraft(), ...d, bank, reviewed: !!bank && d.reviewed, dirty: true };
  }
  state.activities = Object.fromEntries(activities.map(a => [a.activityId, a]));
  if (snapshot.selectedActivity) requireValue(!!state.activities[snapshot.selectedActivity]);
  for (const [id, a] of Object.entries(snapshot.attempts)) {
    const activity = state.activities[id]; requireValue(!!activity);
    if (activity.type === 'QUIZ') {
      requireValue(a.index < activity.content.questions.length && Object.keys(a.cells).length === 0);
      for (const [q, value] of Object.entries(a.answers)) requireValue(activity.content.questions.some(question => question.id === q && question.options.some(o => o.id === value)));
    } else {
      requireValue(Object.keys(a.answers).length === 0);
      const available = new Set(activity.content.cells.map(c => `${c.row}:${c.column}`));
      requireValue(Object.entries(a.cells).every(([cell, value]) => available.has(cell) && /^[A-ZÑ]?$/.test(value)));
    }
    state.attempts[id] = { ...newAttempt(), ...a, status: a.frozen ? 'unresolved' : 'editing' };
  }
  if (snapshot.selectedActivity) state.attempts[snapshot.selectedActivity] ??= newAttempt();
  for (const [id, attemptId] of Object.entries(snapshot.receipts)) {
    requireValue(!!state.activities[id]);
    const result = evaluations.find(e => e.activityId === id && e.attemptId === attemptId && e.subjectId === state.activities[id].subjectId);
    requireValue(!!result);
    state.attempts[id] = { ...newAttempt(), status: 'received', result };
  }
  return state;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('copies', { keyPath: 'id' }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
    request.onerror = () => reject(new Error('No se pudo abrir la copia local. Puedes continuar en memoria.'));
    request.onblocked = () => reject(new Error('Otra pestaña bloquea el almacenamiento. Cierra esa pestaña y reintenta.'));
  });
}
async function transaction<T>(run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('copies', 'readwrite'); let value: T;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('No se confirmó la escritura local. El trabajo sigue en memoria.')); };
    try { run(tx.objectStore('copies'), v => { value = v; }); } catch (error) { tx.abort(); reject(error); }
  });
}
export async function findRecovery(userId: string, subjectId: string) {
  return transaction<RecoveryRecord | null>((store, done) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => { const c = cursor.result; if (c) { if (Number.isFinite(c.value.expiresAt) && c.value.expiresAt <= Date.now()) c.delete(); c.continue(); } };
    const read = store.get(recordId(userId, subjectId)); read.onsuccess = () => { const r = read.result; done(r && r.expiresAt > Date.now() ? r : null); };
  });
}
export async function writeRecovery(record: Omit<RecoveryRecord, 'revision' | 'owner' | 'leaseUntil'>, owner: string, expectedRevision: number, exclusiveLock = false) {
  let conflict = false;
  const revision = await transaction<number>((store, done) => {
    const read = store.get(record.id);
    read.onsuccess = () => {
      try {
        const previous: RecoveryRecord | undefined = read.result;
        if ((previous?.revision ?? 0) !== expectedRevision || !exclusiveLock && previous && previous.owner !== owner && previous.leaseUntil > Date.now()) { conflict = true; done(expectedRevision); return; }
        store.put({ ...record, revision: expectedRevision + 1, owner, leaseUntil: Date.now() + 30_000 }); done(expectedRevision + 1);
      } catch { store.transaction.abort(); }
    };
  });
  if (conflict) throw new Error('Otra pestaña tiene una copia más reciente o está editando. Conserva esta página abierta; desbloquea la copia al terminar allí.');
  return revision;
}
export async function releaseRecovery(userId: string, subjectId: string, owner: string) {
    await transaction<void>((store, done) => { const read = store.get(recordId(userId, subjectId)); read.onsuccess = () => { try { if (read.result?.owner === owner) store.put({ ...read.result, leaseUntil: 0 }); done(); } catch { store.transaction.abort(); } }; });
}
export async function removeRecovery(userId: string, subjectId?: string) {
  await transaction<void>((store, done) => { const cursor = store.openCursor(); cursor.onsuccess = () => { const c = cursor.result; if (!c) { done(); return; } if (c.value.userId === userId && (!subjectId || c.value.subjectId === subjectId)) c.delete(); c.continue(); }; });
}

export async function purgeExpiredRecovery() {
  await transaction<void>((store, done) => { const cursor = store.openCursor(); cursor.onsuccess = () => { const c = cursor.result; if (!c) { done(); return; } if (Number.isFinite(c.value.expiresAt) && c.value.expiresAt <= Date.now()) c.delete(); c.continue(); }; });
}

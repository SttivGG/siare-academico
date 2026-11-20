import type { AcademicController } from './academic-state.ts';
import { decryptRecovery, deriveRecoveryKey, encryptRecovery, findRecovery, releaseRecovery, removeRecovery, restoreSnapshot, writeRecovery, type RecoveryRecord } from './academic-recovery.ts';
import type { Activity, DocumentSource, Evaluation } from './activities.ts';

export type RecoveryStatus = { mode: 'memory' | 'available' | 'saving' | 'saved' | 'error'; message: string; enabled: boolean; exists: boolean };
export type RecoveryAccess = { userId: string; documents: DocumentSource[]; activities: Activity[] };
/** Owns ephemeral keys, serialized writes and the disk revision, never academic data. */
export class RecoverySession {
  private key: CryptoKey | null = null;
  private salt: number[] = [];
  private diskRevision = 0;
  private owner = crypto.randomUUID();
  private generation = 0;
  private savedStateRevision = -1;
  private releaseLock: (() => void) | null = null;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private status: RecoveryStatus = { mode: 'memory', message: 'Trabajo en memoria. Una recarga o cierre puede perderlo.', enabled: false, exists: false };
  readonly controller: AcademicController;
  constructor(controller: AcademicController) {
    this.controller = controller;
    controller.subscribe(() => {
      if (!this.key) return;
      this.set({ mode: 'saving', message: 'Cambios pendientes de guardar en la copia cifrada.' });
      clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 350);
    });
  }
  getSnapshot = () => this.status;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private set(patch: Partial<RecoveryStatus>) { this.status = { ...this.status, ...patch }; this.listeners.forEach(fn => fn()); }
  async discover() {
    try { const record = await findRecovery(this.controller.userId, this.controller.subjectId); if (!this.key) this.set(record ? { exists: true, mode: 'available', message: 'Hay una copia cifrada. Desbloquéala para recuperar; no se enviará ningún intento.' } : { exists: false, mode: 'memory', message: 'Trabajo en memoria. Una recarga o cierre puede perderlo.' }); }
    catch (error) { this.fail(error); }
  }
  private fail(error: unknown) { this.set({ mode: 'error', message: error instanceof Error ? error.message : 'El almacenamiento no está disponible. El trabajo sigue en memoria.' }); }
  private async claim() {
    if (this.releaseLock || typeof navigator === 'undefined' || !navigator.locks) return;
    await new Promise<void>((resolve, reject) => {
      void navigator.locks.request(`siare-recovery/${this.controller.userId}/${this.controller.subjectId}`, { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('Otra pestaña está editando esta copia. Conservamos tu trabajo en memoria.')); return; }
        await new Promise<void>(release => { this.releaseLock = release; resolve(); });
      }).catch(reject);
    });
  }
  async enable(phrase: string, authorize: () => Promise<RecoveryAccess>) {
    try {
      const generation = this.generation;
      const access = await authorize();
      if (access.userId !== this.controller.userId) throw new Error('La sesión actual no corresponde al propietario del trabajo.');
      if (await findRecovery(this.controller.userId, this.controller.subjectId)) throw new Error('Ya hay una copia cifrada. Recupérala o descártala expresamente antes de habilitar otra.');
      const salt = [...crypto.getRandomValues(new Uint8Array(16))];
      const key = await deriveRecoveryKey(phrase, new Uint8Array(salt));
      if (generation !== this.generation) return;
      await this.claim();
      this.salt = salt; this.key = key; this.diskRevision = 0; this.set({ enabled: true, mode: 'saving' }); await this.flush();
    } catch (error) { this.fail(error); throw error; }
  }
  async unlock(phrase: string, authorize: (record: RecoveryRecord) => Promise<RecoveryAccess>, lookup?: (activity: string, attempt: string) => Promise<Evaluation>) {
    try {
      const generation = this.generation;
      const record = await findRecovery(this.controller.userId, this.controller.subjectId);
      if (!record) throw new Error('No hay una copia vigente para recuperar.');
      const access = await authorize(record);
      if (access.userId !== this.controller.userId || access.activities.some(a => a.subjectId !== this.controller.subjectId)) throw new Error('No se pudo verificar la propiedad actual del trabajo.');
      const { snapshot, key } = await decryptRecovery(record, phrase, access.userId, this.controller.subjectId);
      const evaluations = await Promise.all(Object.entries(snapshot.receipts).map(async ([id, attempt]) => { if (!lookup) throw new Error('Falta comprobar el resultado con el servidor.'); return lookup(id, attempt); }));
      const restored = restoreSnapshot(snapshot, access.documents, access.activities, evaluations);
      // Claim in one transaction before replacing any live state. A competing tab cannot overwrite it.
      const encrypted = await encryptRecovery(restored, this.controller.userId, this.controller.subjectId, key, record.salt);
      if (generation !== this.generation) return;
      await this.claim();
      const revision = await writeRecovery(encrypted, this.owner, record.revision, !!this.releaseLock);
      if (generation !== this.generation) return;
      this.controller.restore(restored); this.key = key; this.salt = record.salt; this.diskRevision = revision; this.savedStateRevision = this.controller.getSnapshot().revision;
      this.set({ enabled: true, exists: true, mode: 'saved', message: 'Trabajo recuperado. Copia cifrada guardada en este navegador.' });
    } catch (error) { this.fail(error); throw error; }
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    const generation = this.generation;
    const operation = this.chain.catch(() => {}).then(async () => {
      if (!this.key || generation !== this.generation) return;
      const state = this.controller.getSnapshot();
      if (state.revision === this.savedStateRevision) return;
      const record = await encryptRecovery(state, this.controller.userId, this.controller.subjectId, this.key, this.salt);
      if (generation !== this.generation) return;
      this.diskRevision = await writeRecovery(record, this.owner, this.diskRevision, !!this.releaseLock);
      this.savedStateRevision = state.revision;
      if (generation === this.generation && this.controller.getSnapshot().revision === state.revision) this.set({ mode: 'saved', exists: true, message: 'Copia cifrada guardada en este navegador.' });
    });
    this.chain = operation;
    return operation.catch(error => { this.fail(error); throw error; });
  };
  async lock() { ++this.generation; clearTimeout(this.timer); this.key = null; this.set({ enabled: false, mode: this.status.exists ? 'available' : 'memory', message: 'Copia bloqueada. El trabajo actual continúa en memoria.' }); await this.chain.catch(() => {}); try { await releaseRecovery(this.controller.userId, this.controller.subjectId, this.owner); } finally { this.releaseLock?.(); this.releaseLock = null; } }
  async discard() { await this.lock(); await removeRecovery(this.controller.userId, this.controller.subjectId); this.diskRevision = 0; this.savedStateRevision = -1; this.set({ exists: false, mode: 'memory', message: 'Copia local descartada. El trabajo actual continúa en memoria.' }); }
}

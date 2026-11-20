import { crosswordAnswers, freezeSubmission, type Activity, type ActivityType, type Bank, type DocumentSource, type Evaluation, type Submission } from './activities.ts';

export type Tool = 'catalog' | 'bank' | 'attempt' | 'reading';
export type Panel = 'sources' | 'learning' | 'study';
export const INITIAL_BANK = JSON.stringify({ validated: false, questions: [], words: [] }, null, 2);
export type BankDraft = { raw: string; topic: string; type: ActivityType; count: number; gridSize: number; bank: Bank | null; reviewed: boolean; sourceFingerprint: string | null; dirty: boolean; publishing: boolean };
export type Attempt = { answers: Record<string, string>; cells: Record<string, string>; index: number; direction: 'ACROSS' | 'DOWN'; startedAt: number; frozen: Submission | null; status: 'editing' | 'sending' | 'unresolved' | 'received'; result: Evaluation | null; error: string };
export type AcademicState = { source: DocumentSource | null; panel: Panel; tool: Tool; drafts: Record<string, BankDraft>; activities: Record<string, Activity>; attempts: Record<string, Attempt>; selectedActivity: string | null; revision: number; editedAt: number };
export const newDraft = (): BankDraft => ({ raw: INITIAL_BANK, topic: '', type: 'QUIZ', count: 1, gridSize: 15, bank: null, reviewed: false, sourceFingerprint: null, dirty: false, publishing: false });
export const newAttempt = (): Attempt => ({ answers: {}, cells: {}, index: 0, direction: 'ACROSS', startedAt: Date.now(), frozen: null, status: 'editing', result: null, error: '' });
export const newAcademicState = (): AcademicState => ({ source: null, panel: 'learning', tool: 'catalog', drafts: { external: newDraft() }, activities: {}, attempts: {}, selectedActivity: null, revision: 0, editedAt: Date.now() });
export const sourceKey = (source: DocumentSource | null) => source?.documentId ?? 'external';
export function hasWork(state: AcademicState) {
  return Object.values(state.drafts).some(d => d.dirty) || Object.values(state.attempts).some(a => a.status !== 'received' && (!!a.frozen || Object.keys(a.answers).length > 0 || Object.values(a.cells).some(Boolean)));
}

/** Domain owner: independent of React positions, panels and network view lifetimes. */
export class AcademicController {
  private state = newAcademicState();
  private listeners = new Set<() => void>();
  private alive = true;
  readonly userId: string;
  readonly subjectId: string;
  constructor(userId: string, subjectId: string) { this.userId = userId; this.subjectId = subjectId; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  update(patch: Partial<AcademicState>) { if (!this.alive) return; this.state = { ...this.state, ...patch, revision: this.state.revision + 1 }; this.listeners.forEach(fn => fn()); }
  show(tool: Tool) { this.update({ tool, panel: 'learning' }); }
  selectSource(source: DocumentSource | null) {
    if (sourceKey(source) === sourceKey(this.state.source)) return;
    // Preserve both drafts, but any change of provenance requires human review again.
    const drafts: Record<string, BankDraft> = Object.fromEntries(Object.entries(this.state.drafts).map(([key, draft]) => [key, { ...draft, bank: null, reviewed: false, sourceFingerprint: null }]));
    drafts[sourceKey(source)] ??= newDraft(); this.update({ source, drafts, editedAt: Date.now() });
  }
  draft(key: string, patch: Partial<BankDraft>, invalidate = true) {
    const current = this.state.drafts[key] ?? newDraft();
    this.update({ editedAt: Date.now(), drafts: { ...this.state.drafts, [key]: { ...current, ...patch, ...(invalidate ? { bank: null, reviewed: false } : {}), dirty: patch.dirty ?? true } } });
  }
  open(activity: Activity) {
    if (activity.subjectId !== this.subjectId) throw new Error('La actividad pertenece a otra materia.');
    this.update({ activities: { ...this.state.activities, [activity.activityId]: activity }, attempts: { ...this.state.attempts, [activity.activityId]: this.state.attempts[activity.activityId] ?? newAttempt() }, selectedActivity: activity.activityId, tool: 'catalog', panel: 'learning', editedAt: this.state.attempts[activity.activityId] ? this.state.editedAt : Date.now() });
  }
  attempt(id: string, patch: Partial<Attempt>) {
    const current = this.state.attempts[id];
    if (!current || current.frozen || current.status === 'received') return;
    this.update({ editedAt: Date.now(), attempts: { ...this.state.attempts, [id]: { ...current, ...patch } } });
  }
  restart(id: string) {
    if (this.state.attempts[id]?.status !== 'received') return;
    this.update({ editedAt: Date.now(), attempts: { ...this.state.attempts, [id]: newAttempt() } });
  }
  async submit(id: string, send: (body: Submission) => Promise<Evaluation>, beforeSend?: () => Promise<void>) {
    const attempt = this.state.attempts[id], activity = this.state.activities[id];
    if (!attempt || !activity || attempt.status === 'sending' || attempt.status === 'received' || !this.alive) return;
    const frozen = attempt.frozen ?? freezeSubmission(activity.type === 'QUIZ' ? attempt.answers : crosswordAnswers(activity.content.clues, attempt.cells), attempt.startedAt);
    // Synchronous lock and immutable envelope precede every await (including disk).
    this.update({ editedAt: attempt.frozen ? this.state.editedAt : Date.now(), attempts: { ...this.state.attempts, [id]: { ...attempt, frozen, status: 'sending', error: '' } } });
    try {
      await beforeSend?.();
      if (!this.alive) return;
      const result = await send(frozen);
      if (result.activityId !== id || result.subjectId !== this.subjectId) throw new Error('La evaluación no corresponde al intento enviado.');
      const current = this.state.attempts[id];
      this.update({ attempts: { ...this.state.attempts, [id]: { ...current, status: 'received', result, error: '' } } });
    } catch (error) {
      const current = this.state.attempts[id];
      this.update({ attempts: { ...this.state.attempts, [id]: { ...current, status: 'unresolved', error: error instanceof Error ? error.message : 'No se pudo enviar.' } } });
    }
  }
  restore(state: AcademicState) { this.update(state); }
  destroy() { this.state = newAcademicState(); this.alive = false; this.listeners.forEach(fn => fn()); this.listeners.clear(); }
}

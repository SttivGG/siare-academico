"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UUID } from '../lib/activity-policy';
import type { Activity, ActivitySummary, DocumentSource, Evaluation } from '../lib/activities';
import { ActivityBankEditor } from './activity-bank-editor';
import { ActivityPlayer, EvaluationView } from './activity-player';
import { useAcademic } from './academic-provider';
import { AcademicReading } from './academic-reading';

export function ActivityPanel({ subjectId, archived, document, onResult, onActivity }: { subjectId: string; archived: boolean; document: DocumentSource | null; onResult: (result: Evaluation) => void; onActivity: (activity: Activity) => void }) {
  const { state, controller } = useAcademic(subjectId);
  const tab = state.tool;
  const setTab = (tool: typeof tab) => controller.show(tool);
  const activity = state.selectedActivity ? state.activities[state.selectedActivity] : null;
  const [items, setItems] = useState<ActivitySummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(true);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [history, setHistory] = useState<Evaluation[]>([]);
  const opening = useRef(0);
  const listBusy = useRef(false);
  const load = useCallback(async (next?: string) => {
    if (listBusy.current) return;
    listBusy.current = true; setBusy(true); setError('');
    try {
      const page = await api<{ items: ActivitySummary[]; nextCursor: string | null }>(`subjects/${subjectId}/activities?limit=20${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      setItems(current => [...new Map([...(next ? current : []), ...page.items].map(item => [item.activityId, item])).values()]); setCursor(page.nextCursor); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el catálogo.'); }
    finally { listBusy.current = false; setBusy(false); }
  }, [subjectId]);
  useEffect(() => { void load(); }, [load]);
  const receive = useCallback((value: Evaluation) => {
    onResult(value); setHistory(current => [value, ...current.filter(r => r.attemptId !== value.attemptId)]);
  }, [onResult]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search), id = query.get('activity'), attempt = query.get('attempt');
    if (id && UUID.test(id)) setActivityId(id);
    if (attempt && UUID.test(attempt)) { setAttemptId(attempt); setTab('attempt'); }
  }, []);
  async function open(id: string) {
    const request = ++opening.current; setBusy(true); setError('');
    try { const value = await api<Activity>(`activities/${id}`); if (opening.current === request) { controller.open(value); setCatalogExpanded(false); setResult(null); setActivityId(id); onActivity(value); } }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la actividad.'); }
    finally { if (opening.current === request) setBusy(false); }
  }
  async function lookup(e: React.FormEvent) {
    e.preventDefault(); setError(''); setResult(null);
    if (!UUID.test(activityId) || !UUID.test(attemptId)) { setError('Indica UUID válidos de actividad e intento.'); return; }
    setBusy(true);
    try {
      const value = await api<Evaluation>(`activities/${activityId}/submissions/${attemptId}`);
      if (value.subjectId !== subjectId) throw new Error('El resultado pertenece a otra materia. Abre su espacio para consultarlo.');
      setResult(value); receive(value);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el intento.'); }
    finally { setBusy(false); }
  }
  return <section className="activities-panel" aria-labelledby="activities-title"><h2 id="activities-title">{tab === 'reading' ? 'Lectura documental' : tab === 'bank' ? 'Banco manual' : tab === 'attempt' ? 'Tus intentos' : 'Actividades'}</h2>
    {archived && <p className="notice">Materia archivada: puedes consultar actividades y resultados guardados.</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {tab === 'bank' && !archived && <ActivityBankEditor subjectId={subjectId} document={document} onCreated={value => { controller.open(value); setCatalogExpanded(false); setActivityId(value.activityId); setTab('catalog'); onActivity(value); void load(); }} />}
    {tab === 'catalog' && <>
      <details className="catalog-picker" open={!activity || catalogExpanded} onToggle={event => setCatalogExpanded(event.currentTarget.open)}><summary>{activity ? 'Cambiar actividad' : 'Explorar catálogo'}</summary>
      <div className="document-toolbar"><h3>Tu catálogo</h3><button className="button subtle" disabled={busy} onClick={() => void load()}>Actualizar catálogo</button></div>
      {busy && <p role="status">Consultando actividades…</p>}
      {loaded && !items.length && <p className="notice">Todavía no hay actividades. Selecciona un documento READY y prepara un banco revisado.</p>}
      <ul className="activity-catalog">{items.map(item => <li key={item.activityId}><button className="activity-card" data-activity-id={item.activityId} disabled={busy || !item.available} aria-pressed={activity?.activityId === item.activityId} onClick={() => void open(item.activityId)}><span className={`activity-kind ${item.type === 'QUIZ' ? 'rose' : 'mint'}`}>{item.type === 'QUIZ' ? 'Quiz' : 'Crucigrama'}</span><strong>{item.title}</strong></button></li>)}</ul>
      {cursor && <button className="button secondary full" disabled={busy} onClick={() => void load(cursor)}>Cargar más actividades</button>}
      </details>
      {activity && <ActivityPlayer key={activity.activityId} activity={activity} archived={archived} />}
    </>}
    {tab === 'reading' && <AcademicReading document={document} />}
    {tab === 'attempt' && <div className="form-stack"><h3>Consultar resultado guardado</h3><p className="hint">Usa los IDs de un intento anterior. H3 permite consultar un intento propio por ID; el listado completo de intentos aún no está disponible.</p>
      <form className="form-stack" onSubmit={lookup}><div className="field"><label htmlFor="lookup-activity">ID de actividad</label><input id="lookup-activity" required value={activityId} onChange={e => setActivityId(e.target.value.trim())} /></div><div className="field"><label htmlFor="lookup-attempt">ID de intento</label><input id="lookup-attempt" required value={attemptId} onChange={e => setAttemptId(e.target.value.trim())} /></div><button className="button primary" disabled={busy}>Consultar evaluación</button></form>
      {history.length > 0 && <section><h3>Consultados en esta sesión de pantalla</h3><ul>{history.map(value => <li key={value.attemptId}><a className="text-link identity-id" href={`?activity=${value.activityId}&attempt=${value.attemptId}`}>{value.attemptId}</a></li>)}</ul></section>}
      {result && <EvaluationView result={result} />}
    </div>}
  </section>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UUID } from '../lib/activity-policy';
import type { Activity, ActivitySummary, DocumentSource, Evaluation } from '../lib/activities';
import { ActivityBankEditor } from './activity-bank-editor';
import { ActivityPlayer, EvaluationView } from './activity-player';

export function ActivityPanel({ subjectId, archived, document, onResult, onActivity }: { subjectId: string; archived: boolean; document: DocumentSource | null; onResult: (result: Evaluation) => void; onActivity: (activity: ActivitySummary) => void }) {
  const [tab, setTab] = useState<'catalog' | 'bank' | 'attempt'>('catalog');
  const [items, setItems] = useState<ActivitySummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
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
  useEffect(() => {
    if (!unconfirmed) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [unconfirmed]);
  async function open(id: string) {
    const request = ++opening.current; setBusy(true); setError('');
    try { const value = await api<Activity>(`activities/${id}`); if (opening.current === request) { setActivity(value); setResult(null); setActivityId(id); onActivity(value); } }
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
  return <aside className="panel activities-panel" aria-labelledby="activities-title"><span className="eyebrow">Practica a tu ritmo</span><h2 id="activities-title">Actividades</h2>
    <div className="activity-tabs" aria-label="Secciones de actividades">{([['catalog', 'Catálogo'], ['bank', 'Preparar banco'], ['attempt', 'Intentos']] as const).map(([key, label]) => <button type="button" key={key} className="button secondary" aria-pressed={tab === key} disabled={busy || unconfirmed || archived && key === 'bank'} onClick={() => { setTab(key); setError(''); }}>{label}</button>)}</div>
    {archived && <p className="notice">Materia archivada: puedes consultar actividades y resultados guardados.</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {tab === 'bank' && !archived && <ActivityBankEditor subjectId={subjectId} document={document} onCreated={value => { setActivity(value); setActivityId(value.activityId); setTab('catalog'); onActivity(value); void load(); }} />}
    {tab === 'catalog' && <>
      <div className="document-toolbar"><h3>Tu catálogo</h3><button className="button subtle" disabled={busy || unconfirmed} onClick={() => void load()}>Actualizar catálogo</button></div>
      {busy && <p role="status">Consultando actividades…</p>}
      {loaded && !items.length && <p className="notice">Todavía no hay actividades. Selecciona un documento READY y prepara un banco revisado.</p>}
      <ul className="activity-catalog">{items.map(item => <li key={item.activityId}><button className="activity-card" disabled={busy || unconfirmed} aria-pressed={activity?.activityId === item.activityId} onClick={() => void open(item.activityId)}><span className={`activity-kind ${item.type === 'QUIZ' ? 'rose' : 'mint'}`}>{item.type === 'QUIZ' ? 'Quiz' : 'Crucigrama'}</span><strong>{item.title}</strong><span className="hint">{new Date(item.createdAt).toLocaleDateString('es-CO')}</span></button></li>)}</ul>
      {cursor && <button className="button secondary full" disabled={busy || unconfirmed} onClick={() => void load(cursor)}>Cargar más actividades</button>}
      {activity && <ActivityPlayer key={activity.activityId} activity={activity} archived={archived} onResult={receive} onPending={setUnconfirmed} />}
    </>}
    {tab === 'attempt' && <div className="form-stack"><h3>Consultar resultado guardado</h3><p className="hint">Usa los IDs de un intento anterior. H3 permite consultar un intento propio por ID; el listado completo de intentos aún no está disponible.</p>
      <form className="form-stack" onSubmit={lookup}><div className="field"><label htmlFor="lookup-activity">ID de actividad</label><input id="lookup-activity" required value={activityId} onChange={e => setActivityId(e.target.value.trim())} /></div><div className="field"><label htmlFor="lookup-attempt">ID de intento</label><input id="lookup-attempt" required value={attemptId} onChange={e => setAttemptId(e.target.value.trim())} /></div><button className="button primary" disabled={busy}>Consultar evaluación</button></form>
      {history.length > 0 && <section><h3>Consultados en esta sesión de pantalla</h3><ul>{history.map(value => <li key={value.attemptId}><a className="text-link identity-id" href={`?activity=${value.activityId}&attempt=${value.attemptId}`}>{value.attemptId}</a></li>)}</ul></section>}
      {result && <EvaluationView result={result} />}
    </div>}
    <div className="future-activities"><h3>Más adelante</h3><p className="hint">Exámenes, simulacros, tarjetas y otros juegos: no disponibles todavía.</p></div>
  </aside>;
}

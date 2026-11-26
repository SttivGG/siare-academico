"use client";

import { useEffect, useRef, useState } from 'react';
import { useAcademic } from './academic-provider';
import { INITIAL_BANK, newDraft, sourceKey } from '../lib/academic-state';
import { api } from '../lib/api';
import { parseBank, validateGeneration, type Activity, type ActivityType, type Bank, type DocumentSource, type Fragment } from '../lib/activities';

export function ActivityBankEditor({ subjectId, document, onCreated }: { subjectId: string; document: DocumentSource | null; onCreated: (activity: Activity) => void }) {
  const { state, controller } = useAcademic(subjectId);
  const key = sourceKey(document), draft = state.drafts[key] ?? newDraft();
  const { raw, bank, reviewed, type, topic, count, gridSize } = draft;
  const setRaw = (raw: string) => controller.draft(key, { raw });
  const setBank = (bank: Bank | null) => controller.draft(key, { bank }, false);
  const setReviewed = (reviewed: boolean) => controller.draft(key, { reviewed }, false);
  const setType = (type: ActivityType) => controller.draft(key, { type });
  const setTopic = (topic: string) => controller.draft(key, { topic });
  const setCount = (count: number) => controller.draft(key, { count });
  const setGridSize = (gridSize: number) => controller.draft(key, { gridSize });
  const publishing = useRef(false);
  const [fragments, setFragments] = useState<Fragment[] | null>(null);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const pending = draft.publishing;
  const setPending = (publishing: boolean) => controller.draft(key, { publishing, dirty: controller.getSnapshot().drafts[key]?.dirty ?? false }, false);
  const [sourceRetry, setSourceRetry] = useState(0);
  useEffect(() => {
    let active = true; setFragments(null); setSourceError('');
    if (document) api<{ fragments: Fragment[] }>(`documents/${document.documentId}/text`).then(async data => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data.fragments)));
      const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (active) {
        setFragments(data.fragments);
        if (controller.getSnapshot().drafts[key]?.sourceFingerprint !== fingerprint) controller.draft(key, { sourceFingerprint: fingerprint, dirty: controller.getSnapshot().drafts[key]?.dirty ?? false }, true);
      }
    }).catch(e => { if (active) setSourceError(e.message); });
    return () => { active = false; };
  }, [document?.documentId, sourceRetry, controller, key]);
  function edit(value: string) { setRaw(value); setBank(null); setReviewed(false); setError(''); }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('El archivo JSON supera 4 MiB.'); return; }
    try { edit(await file.text()); } catch { setError('No se pudo leer el archivo.'); }
  }
  function review() {
    setError(''); setReviewed(false); setBank(null);
    try {
      if (document && !fragments) throw new Error('Espera a que se cargue el texto de la fuente.');
      const draft = parseBank(raw); validateGeneration(draft, type, topic.trim(), count, gridSize, document ? fragments! : undefined); setBank(draft);
    } catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();

    // El banco vacío ya no se envía al backend como una creación inválida.
    if (!bank) {
      setError(document && type === 'QUIZ'
        ? 'Primero pulsa “Generar Quiz con Gemini”. El botón manual solo se habilita después de revisar un banco válido.'
        : 'Primero valida y revisa un banco estructurado.');
      return;
    }

    if (publishing.current || controller.getSnapshot().drafts[key]?.publishing) return;

    publishing.current = true;
    setPending(true);
    setError('');
    try {
      validateGeneration(bank, type, topic.trim(), count, gridSize, document ? fragments! : undefined);
      const body = { type, topic: topic.trim(), count, gridSize, ...(document ? { documentId: document.documentId } : {}), bank: { ...bank, validated: true } };
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 4 * 1024 * 1024) throw new Error('El banco completo supera 4 MiB.');
      const activity = await api<Activity>(`subjects/${subjectId}/activities`, 'POST', body);
      controller.draft(key, { ...newDraft(), dirty: false }, false);
      onCreated(activity);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear la actividad.');
    } finally {
      publishing.current = false;
      setPending(false);
    }
  }

  function addEntry() {
    try {
      const draft = JSON.parse(raw);
      const list = type === 'QUIZ' ? 'questions' : 'words';
      const source = document ? { reference: document.originalFilename, fragmentIndex: fragments?.[0]?.index ?? 0, quote: '' } : null;
      const entry = type === 'QUIZ'
        ? { id: `q${(draft.questions?.length ?? 0) + 1}`, prompt: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }], correctOptionId: 'a', explanation: '', topic: topic.trim(), source }
        : { id: `w${(draft.words?.length ?? 0) + 1}`, answer: '', clue: '', topic: topic.trim(), source };
      draft[list] = [...(draft[list] ?? []), entry];
      edit(JSON.stringify(draft, null, 2));
    } catch {
      setError('Corrige el JSON antes de añadir una entrada.');
    }
  }

  async function generateWithGemini(e: React.FormEvent) {
    e.preventDefault();
    if (!document || pending || type !== 'QUIZ') return;

    // Validación local antes de red: evita payloads 400 por tema o fuente ausentes.
    if (!topic.trim()) {
      setError('Escribe el tema exacto del banco antes de generar el Quiz.');
      return;
    }
    if (!fragments || fragments.length === 0) {
      setError('Espera a que el documento READY tenga texto extraído disponible.');
      return;
    }

    setError('');
    setPending(true);
    try {
      // Spring valida la propiedad del documento y el estado READY; Flask/Gemini genera
      // exclusivamente el banco de esta solicitud sin exponer la clave al navegador.
      const body = {
        type: 'QUIZ',
        documentId: document.documentId,
        topic: topic.trim(),
        count,
        gridSize,
      };
      const activity = await api<Activity>(`subjects/${subjectId}/activities`, 'POST', body);
      controller.draft(key, { ...newDraft(), dirty: false }, false);
      onCreated(activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Quiz con Gemini.');
    } finally {
      setPending(false);
    }
  }

  return <form className="bank-editor form-stack" onSubmit={publish} aria-busy={pending}>
    <h3>Preparar banco</h3><p className="hint">Puedes crear un Quiz revisable automáticamente desde el documento seleccionado o mantener el banco manual existente.</p>
    <p className="source-note">{document ? `Fuente READY: ${document.originalFilename}` : 'Sin documento asociado. Selecciona un documento READY para usar Gemini.'}</p>
    {document && type === 'QUIZ' && <section className="notice" aria-label="Generación con Gemini">
      <h4>Crear automáticamente con Gemini</h4>
      <p>Genera las preguntas desde el texto extraído y usa conocimiento relacionado solo para aclarar ambigüedades. Las citas siguen identificando el documento como fuente principal.</p>
      <button className="button primary" type="button" onClick={generateWithGemini} disabled={pending || !fragments || !topic.trim()}>
        {pending ? 'Generando con Gemini…' : 'Generar Quiz con Gemini'}
      </button>
      {!topic.trim() && <p className="hint">Primero escribe el tema exacto del Quiz.</p>}
      {!fragments && <p className="hint">Espera a que termine de cargarse el texto del documento.</p>}
    </section>}
    {document && !fragments && !sourceError && <p role="status">Cargando texto de la fuente para generar y verificar las citas…</p>}
    {sourceError && <p className="notice error" role="alert">{sourceError}<button type="button" className="button secondary" onClick={() => setSourceRetry(sourceRetry + 1)}>Reintentar texto</button></p>}
    {document && fragments && <details><summary>Consultar fragmentos y citas</summary><div className="source-fragments">{fragments.map(f => <section key={f.index}><h4>Fragmento {f.index} · {f.unitType} {f.unitNumber}</h4><p className="preserve-lines">{f.text}</p></section>)}</div></details>}
    <fieldset disabled={pending} className="form-stack bank-fields">
      <div className="field"><label htmlFor="activity-type">Actividad</label><select id="activity-type" value={type} onChange={e => { setType(e.target.value as ActivityType); setCount(e.target.value === 'QUIZ' ? 1 : 2); setBank(null); setReviewed(false); }}><option value="QUIZ">Quiz</option><option value="CROSSWORD">Crucigrama</option></select></div>
      <div className="field"><label htmlFor="activity-topic">Tema exacto del banco</label><input id="activity-topic" value={topic} maxLength={100} required onChange={e => { setTopic(e.target.value); setBank(null); setReviewed(false); }} /></div>
      <div className="editor-numbers"><div className="field"><label htmlFor="activity-count">Cantidad</label><input id="activity-count" type="number" min={type === 'QUIZ' ? 1 : 2} max={type === 'QUIZ' ? 50 : 12} value={count} onChange={e => { setCount(Number(e.target.value)); setBank(null); setReviewed(false); }} /></div>
        <div className="field"><label htmlFor="activity-grid">Tamaño de cuadrícula</label><input id="activity-grid" type="number" min={5} max={25} value={gridSize} onChange={e => { setGridSize(Number(e.target.value)); setBank(null); setReviewed(false); }} /></div></div>
      <div className="field"><label htmlFor="bank-file">Importar ActivityBank (.json)</label><input id="bank-file" type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></div>
      <div className="field"><label htmlFor="bank-json">Editar banco JSON</label><textarea id="bank-json" spellCheck={false} rows={14} value={raw} onChange={e => edit(e.target.value)} aria-describedby="bank-format" /></div>
      <details id="bank-format"><summary>Formato y límites H3</summary><p className="hint">Máximo 50 preguntas, 2–6 opciones por pregunta y 12 palabras de 2–25 letras. IDs únicos de 1–64 caracteres. Cada pregunta lleva prompt, options, correctOptionId, explanation y topic; cada palabra, answer, clue y topic. Con documento, cada entrada requiere source con reference, fragmentIndex y quote literal que contenga la respuesta. El tema distingue mayúsculas.</p></details>
      <div className="actions"><button className="button secondary" type="button" onClick={addEntry}>Añadir {type === 'QUIZ' ? 'pregunta' : 'palabra'} vacía</button><button className="button secondary" type="button" disabled={!!document && !fragments} onClick={review}>Validar y revisar banco</button></div>
      {bank && <section aria-label="Revisión del banco" className="bank-review"><h4>Revisión antes de publicar</h4><p className="hint">La validación comprueba estructura y evidencia. Revisa también exactitud, claridad y calidad académica de todas las entradas.</p>
        {[...bank.questions, ...bank.words].map((entry, i) => <article key={i}><strong>{entry.id} · {'prompt' in entry ? entry.prompt : entry.clue}</strong><p>Tema: {entry.topic}</p>
          {'options' in entry && <ul>{entry.options.map(o => <li key={o.id}>{o.id}: {o.text}</li>)}</ul>}
          <p>Respuesta del autor: {'answer' in entry ? entry.answer : entry.correctOptionId}</p>{'explanation' in entry && <p>{entry.explanation}</p>}
          {entry.source && <p className="preserve-lines">{entry.source.reference} · fragmento {entry.source.fragmentIndex}<br />Cita: {entry.source.quote}</p>}</article>)}
        <label className="review-checkbox"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />He revisado las preguntas, respuestas, explicaciones y fuentes de este banco.</label>
      </section>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button primary full" type="submit" disabled={!bank || !reviewed || !!document && !fragments}>{pending ? 'Creando actividad…' : `Crear ${type === 'QUIZ' ? 'Quiz' : 'Crucigrama'} revisado`}</button>
    </fieldset>
  </form>;
}

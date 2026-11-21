"use client";

import Link from "next/link";
import { WorkspaceColumns, WorkspaceShell } from "./layout/workspace-shell";
import { Dialog } from "./ui/dialog";
import { useEffect, useState } from "react";
import { api, type Subject } from "../lib/api";
import { SubjectForm } from "./subject-form";
import { ActivityPanel } from "./activity-panel";
import type { Activity, DocumentSource, Evaluation } from "../lib/activities";
import { useAcademic } from './academic-provider';
import { AcademicRecovery } from './academic-recovery';
import { SubjectDocuments } from "./subject-documents";

export function SubjectWorkspace({ id }: { id: string }) {
  const { state, controller } = useAcademic(id);
  const document = state.source;
  const [result, setResult] = useState<Evaluation | null>(null);
  const [recent, setRecent] = useState<Activity | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [attempt, setAttempt] = useState(0);
  function show(tool: typeof state.tool) { controller.show(tool); requestAnimationFrame(() => window.document.getElementById('learning-title')?.focus()); }
  useEffect(() => {
    let active = true;
    setError("");
    api<Subject>(`subjects/${id}`).then(data => { if (active) setSubject(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id, attempt]);
  async function archive() {
    setPending(true); setError("");
    try { setSubject(await api<Subject>(`subjects/${id}/archive`, "PATCH")); setConfirm(false); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo archivar."); }
    finally { setPending(false); }
  }
  if (!subject) return error ? <div className="notice error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(attempt + 1)}>Volver a intentar</button><Link href="/materias">Volver a mis materias</Link></div> : <p role="status">Cargando la materia…</p>;
  return <WorkspaceShell><Link href="/materias" className="back-link">← Mis materias</Link><header className="page-heading"><span className="eyebrow">Espacio de trabajo</span>
    <h1>{subject.name}</h1><span className="badge">{subject.archived ? "Archivada" : "Activa"}</span><p className="muted preserve-lines">{subject.description || "Añade una descripción para darle contexto a tu materia."}</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <AcademicRecovery subjectId={id} />
    <WorkspaceColumns panel={state.panel} onPanelChange={panel => controller.update({ panel })}
      sources={<SubjectDocuments subjectId={id} archived={subject.archived} selectedId={document?.documentId} compact onSelect={value => { controller.selectSource(value); if (state.tool !== 'bank') show('reading'); }} onRead={value => { controller.selectSource(value); show('reading'); }} />}
      learning={<section className="panel learning-panel" aria-labelledby="learning-title"><span className="eyebrow">Tu cuaderno de estudio</span><h2 id="learning-title" tabIndex={-1}>Aprendizaje</h2>
        {state.tool === 'catalog' && !state.selectedActivity && <div className="learning-welcome"><h3>Un paso más cerca de entender.</h3><p>Reúne tus fuentes, prepara una actividad y aprende con la retroalimentación de tus respuestas.</p><p className="muted">Todavía no has consultado evaluaciones aquí. Los resultados aparecerán cuando Spring evalúe un intento o consultes uno guardado.</p></div>}
        <nav className="activity-tabs" aria-label="Herramientas de aprendizaje">{([['reading', 'Lectura'], ['catalog', 'Catálogo'], ['bank', 'Preparar banco'], ['attempt', 'Intentos']] as const).map(([tool, label]) => <button key={tool} className="button secondary" aria-pressed={state.tool === tool} disabled={subject.archived && tool === 'bank'} onClick={() => show(tool)}>{label}</button>)}</nav>
        <ActivityPanel subjectId={id} archived={subject.archived} document={document} onResult={setResult} onActivity={setRecent} />
        <details className="subject-settings"><summary>Datos de la materia</summary><p className="muted section-intro">Mantén tu espacio organizado.</p>
      {subject.archived ? <p className="notice" role="status">Esta materia está archivada. Sus datos se conservan para que puedas consultarlos.</p> : <SubjectForm subject={subject} onSaved={setSubject} />}
        {!subject.archived && <div className="archive-area"><h3>Archivar materia</h3><p className="muted">Dejará de aparecer entre las activas. Sus datos no se eliminarán.</p>
          <button className="button secondary" onClick={() => { setError(""); setConfirm(true); }}>Archivar materia</button>
          <Dialog open={confirm} title="Archivar materia" busy={pending} onClose={() => setConfirm(false)} actions={<><button className="button danger" disabled={pending} onClick={archive}>{pending ? "Archivando…" : "Confirmar archivo"}</button><button className="button secondary" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</button></>}><p>¿Quieres archivar «{subject.name}»? Sus datos se conservarán para consulta.</p>{error && <p className="notice error" role="alert">{error}</p>}</Dialog></div>}</details></section>}
      study={<aside className="panel study-panel"><span className="eyebrow">Practica a tu ritmo</span><h2>Estudio</h2><p className="hint">Elige una herramienta para trabajar en Aprendizaje.</p><div className="study-tools">{([['reading', 'Lectura documental'], ['catalog', 'Quiz y Crucigrama'], ['bank', 'Editor de banco'], ['attempt', 'Consultar intentos']] as const).map(([tool, label]) => <button key={tool} className="button secondary" aria-pressed={state.tool === tool} disabled={subject.archived && tool === 'bank'} onClick={() => show(tool)}>{label}</button>)}</div><p className="hint source-note">{document ? `Fuente: ${document.originalFilename}` : 'Sin fuente seleccionada'}</p><p className="hint">Borradores y respuestas se conservan al cambiar de herramienta.</p></aside>}
    />
  </WorkspaceShell>;
}

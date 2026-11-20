"use client";

import Link from "next/link";
import { WorkspaceShell } from "./layout/workspace-shell";
import { useEffect, useState } from "react";
import { api, type Subject } from "../lib/api";
import { SubjectForm } from "./subject-form";
import { ActivityPanel } from "./activity-panel";
import type { ActivitySummary, DocumentSource, Evaluation } from "../lib/activities";
import { SubjectDocuments } from "./subject-documents";

export function SubjectWorkspace({ id }: { id: string }) {
  const [document, setDocument] = useState<DocumentSource | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [recent, setRecent] = useState<ActivitySummary | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
    <p className="notice warning">Los borradores y las respuestas de esta sesión no se recuperan al recargar o cerrar la página.</p>
    <nav className="workspace-jumps" aria-label="Paneles de la materia"><a href="#documents-title">Documentos</a><a href="#learning-title">Aprendizaje</a><a href="#activities-title">Actividades</a></nav><div className="learning-grid"><SubjectDocuments subjectId={id} archived={subject.archived} selectedId={document?.documentId} onSelect={setDocument} /><section className="panel learning-panel" aria-label="Aprendizaje"><span className="eyebrow">Tu cuaderno de estudio</span><h2 id="learning-title">Aprendizaje</h2><div className="learning-welcome"><h3>Un paso más cerca de entender.</h3><p>Reúne tus fuentes, prepara una actividad y aprende con la retroalimentación de tus respuestas.</p></div><section className="learning-card"><h3>Actividad reciente</h3>{recent ? <><p>{recent.type === "QUIZ" ? "Quiz" : "Crucigrama"} · {recent.title}</p><p className="hint">Creada el {new Date(recent.createdAt).toLocaleDateString("es-CO")}</p></> : <p className="muted">Abre una actividad del catálogo o crea la primera de esta materia.</p>}</section><section className="learning-card"><h3>Última evaluación consultada</h3>{result ? <><p className="result-score">{result.percentage}%</p><p>{result.points} de {result.total} aciertos · {result.feedback}</p><a className="text-link" href={`?activity=${result.activityId}&attempt=${result.attemptId}`}>Consultar resultado</a></> : <p className="muted">Todavía no has consultado evaluaciones aquí. Los resultados aparecerán cuando Spring evalúe un intento o consultes uno guardado.</p>}</section><section className="learning-card future-indicators"><h3>Tu progreso, con contexto</h3><p className="muted">Los indicadores históricos y las recomendaciones esperan la integración de analítica y ML.</p></section><details className="subject-settings" open><summary>Datos de la materia</summary><p className="muted section-intro">Mantén tu espacio organizado.</p>
      {subject.archived ? <p className="notice" role="status">Esta materia está archivada. Sus datos se conservan para que puedas consultarlos.</p> : <SubjectForm subject={subject} onSaved={setSubject} />}
        {!subject.archived && <div className="archive-area"><h3>Archivar materia</h3><p className="muted">Dejará de aparecer entre las activas. Sus datos no se eliminarán.</p>
          {confirm ? <div className="confirm-box"><p>¿Quieres archivar «{subject.name}»?</p><div className="actions"><button className="button danger" disabled={pending} onClick={archive}>{pending ? "Archivando…" : "Confirmar archivo"}</button><button className="button secondary" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</button></div></div>
            : <button className="button secondary" onClick={() => setConfirm(true)}>Archivar materia</button>}</div>}</details></section><ActivityPanel subjectId={id} archived={subject.archived} document={document} onResult={setResult} onActivity={setRecent} /></div>
  </WorkspaceShell>;
}

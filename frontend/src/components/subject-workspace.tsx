"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Subject } from "../lib/api";
import { SubjectForm } from "./subject-form";

export function SubjectWorkspace({ id }: { id: string }) {
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
  return <><Link href="/materias" className="back-link">← Mis materias</Link><header className="page-heading"><span className="eyebrow">Espacio de trabajo</span>
    <h1>{subject.name}</h1><span className="badge">{subject.archived ? "Archivada" : "Activa"}</span><p className="muted preserve-lines">{subject.description || "Añade una descripción para darle contexto a tu materia."}</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="workspace-grid"><section className="panel"><h2>Datos de la materia</h2><p className="muted section-intro">Mantén tu espacio organizado.</p>
      {subject.archived ? <p className="notice" role="status">Esta materia está archivada. Sus datos se conservan para que puedas consultarlos.</p> : <SubjectForm subject={subject} onSaved={setSubject} />}</section>
      <aside className="panel quiet-panel"><span className="eyebrow">Próximas fases</span><h2>Tu aprendizaje empieza aquí</h2><p className="muted">Este espacio ya guarda los datos de tu materia. Los documentos y las actividades educativas estarán disponibles en una fase posterior.</p>
        {!subject.archived && <div className="archive-area"><h3>Archivar materia</h3><p className="muted">Dejará de aparecer entre las activas. Sus datos no se eliminarán.</p>
          {confirm ? <div className="confirm-box"><p>¿Quieres archivar «{subject.name}»?</p><div className="actions"><button className="button danger" disabled={pending} onClick={archive}>{pending ? "Archivando…" : "Confirmar archivo"}</button><button className="button secondary" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</button></div></div>
            : <button className="button secondary" onClick={() => setConfirm(true)}>Archivar materia</button>}</div>}</aside></div>
  </>;
}

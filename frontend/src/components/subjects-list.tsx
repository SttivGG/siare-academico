"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Subject } from "../lib/api";

export function SubjectsList() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("active");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api<Subject[]>("subjects").then(data => { if (active) setSubjects(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <div className="notice error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(attempt + 1)}>Volver a intentar</button></div>;
  if (!subjects) return <p role="status" className="muted">Cargando tus materias…</p>;
  const visible = subjects.filter(subject => filter === "all" || subject.archived === (filter === "archived"));
  return <><div className="list-toolbar"><label htmlFor="subject-filter">Mostrar</label>
    <select id="subject-filter" value={filter} onChange={event => setFilter(event.target.value)}>
      <option value="active">Activas</option><option value="archived">Archivadas</option><option value="all">Todas</option></select>
    <span className="muted" role="status">{visible.length} {visible.length === 1 ? "materia" : "materias"}</span></div>
    {visible.length === 0 ? <section className="empty-state"><span className="eyebrow">Tu próximo paso</span><h2>{filter === "archived" ? "No hay materias archivadas" : "Un espacio para cada materia"}</h2>
      <p className="muted">{filter === "archived" ? "Las materias que archives seguirán disponibles aquí." : "Crea una materia para empezar a organizar tu aprendizaje."}</p>
      {filter !== "archived" && <Link className="button primary" href="/materias/nueva">Crear mi primera materia</Link>}</section>
      : <div className="subject-grid">{visible.map((subject, index) => <article className="subject-card" key={subject.id}>
        <div className="card-top"><span className="subject-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="badge">{subject.archived ? "Archivada" : "Activa"}</span></div>
        <h2><Link href={`/materias/${subject.id}`}>{subject.name}</Link></h2><p className="muted description">{subject.description || "Sin descripción por ahora."}</p>
        <Link className="text-link" href={`/materias/${subject.id}`}>Abrir materia <span aria-hidden="true">→</span></Link></article>)}</div>}
  </>;
}

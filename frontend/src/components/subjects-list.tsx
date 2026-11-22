"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Subject } from "../lib/api";
import { Button, Field, LoadingState, Select } from "./ui/primitives";
import styles from "./ui/sections.module.css";
import study from "./layout/overview.module.css";

export function SubjectsList() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("active");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    api<Subject[]>("subjects").then(data => { if (active) setSubjects(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <div className="notice error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(attempt + 1)}>Volver a intentar</button></div>;
  if (!subjects) return <LoadingState>Cargando tus materias…</LoadingState>;
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = subjects.filter(subject => (filter === "all" || subject.archived === (filter === "archived")) && (!normalized || `${subject.name} ${subject.description ?? ""}`.toLocaleLowerCase("es").includes(normalized)));
  return <div className={styles.stack}><search aria-label="Buscar y filtrar materias" className={styles.toolbar}>
    <Field label="Buscar materias" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o descripción" />
    <Select label="Mostrar" id="subject-filter" value={filter} onChange={event => setFilter(event.target.value)}>
      <option value="active">Activas</option><option value="archived">Archivadas</option><option value="all">Todas</option></Select>
    <span className="muted" role="status">{visible.length} {visible.length === 1 ? "materia" : "materias"}</span></search>
    {visible.length === 0 ? <section className="empty-state"><span className="eyebrow">Tu próximo paso</span><h2>{normalized ? "No encontramos materias" : filter === "archived" ? "No hay materias archivadas" : "Un espacio para cada materia"}</h2>
      <p className="muted">{normalized ? "Prueba con otro nombre o cambia el filtro. La búsqueda usa tus materias disponibles." : filter === "archived" ? "Las materias que archives seguirán disponibles aquí." : "Crea una materia para empezar a organizar tu aprendizaje."}</p>
      {normalized ? <Button variant="secondary" onClick={() => setQuery("")}>Limpiar búsqueda</Button> : filter !== "archived" && <Link className="button primary" href="/materias/nueva">Crear mi primera materia</Link>}</section>
      : <div className={`subject-grid ${study.subjects}`}>{visible.map((subject, index) => <article className="subject-card" key={subject.id}>
        <div className="card-top"><span className="subject-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="badge">{subject.archived ? "Archivada" : "Activa"}</span></div>
        <h2><Link href={`/materias/${subject.id}`}>{subject.name}</Link></h2><p className="muted description">{subject.description || "Sin descripción por ahora."}</p>
        <Link className="text-link" href={`/materias/${subject.id}`}>Abrir materia <span aria-hidden="true">→</span></Link></article>)}</div>}
  </div>;
}

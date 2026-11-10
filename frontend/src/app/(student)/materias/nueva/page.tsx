import Link from "next/link";
import { SubjectForm } from "../../../../components/subject-form";

export const metadata = { title: "Crear materia" };

export default function NewSubject() {
  return <div className="narrow-content"><Link className="back-link" href="/materias">← Mis materias</Link><header className="page-heading"><span className="eyebrow">Un nuevo espacio</span><h1>Crear materia</h1><p className="muted">Ponle nombre a lo que vas a aprender.</p></header><section className="panel"><SubjectForm /></section></div>;
}

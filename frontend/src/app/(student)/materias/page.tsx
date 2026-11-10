import Link from "next/link";
import { SubjectsList } from "../../../components/subjects-list";

export const metadata = { title: "Mis materias" };

export default function Subjects() {
  return <><header className="page-heading heading-with-action"><div><span className="eyebrow">Organiza tu aprendizaje</span><h1>Mis materias</h1><p className="muted">Un espacio para cada cosa que estás aprendiendo.</p></div><Link href="/materias/nueva" className="button primary">+ Crear materia</Link></header><SubjectsList /></>;
}

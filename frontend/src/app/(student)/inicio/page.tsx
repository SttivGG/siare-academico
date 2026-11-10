import Link from "next/link";
import { requireStudent } from "../../../lib/server-session";

export const metadata = { title: "Inicio" };

export default async function StudentHome() {
  const user = await requireStudent();
  return <><header className="page-heading"><span className="eyebrow">Mi espacio</span><h1>Hola, {user.name}.</h1><p className="lead muted">Todo empieza con una materia. Dale un lugar a lo que quieres aprender.</p></header>
    <section className="home-feature"><div><span className="small-label">ORGANIZA TU APRENDIZAJE</span><h2>Tus materias, en un solo lugar</h2><p className="muted">Crea un espacio para cada asignatura, añade una descripción y mantén a mano lo que estás estudiando.</p><div className="actions"><Link href="/materias" className="button primary">Ir a mis materias <span aria-hidden="true">→</span></Link><Link href="/materias/nueva" className="button secondary">Crear materia</Link></div></div><div className="feature-mark" aria-hidden="true"><span>01</span><span>Una materia.<br />Un nuevo comienzo.</span></div></section>
    <p className="phase-note">Esta primera fase te permite gestionar tus materias. Las actividades y los materiales de estudio llegarán más adelante.</p></>;
}

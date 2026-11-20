import Link from "next/link";
import { requireStudent } from "../../../lib/server-session";
import { Icon } from "../../../components/ui/icon";
import styles from "../../../components/layout/overview.module.css";

export const metadata = { title: "Inicio" };

export default async function StudentHome() {
  const user = await requireStudent();
  return <><header className="page-heading"><span className="eyebrow">Mi espacio</span><h1>Hola, {user.name}.</h1><p className="lead muted">Todo empieza con una materia. Dale un lugar a lo que quieres aprender.</p></header>
    <div className={styles.dashboard}><section className={styles.dashboardHero}><div><span className="small-label">ORGANIZA TU APRENDIZAJE</span><h2>Tus materias, en un solo lugar</h2><p className="muted">Crea un espacio para cada asignatura, añade una descripción y mantén a mano lo que estás estudiando.</p><div className="actions"><Link href="/materias" className="button primary">Ir a mis materias <span aria-hidden="true">→</span></Link><Link href="/materias/nueva" className="button secondary">Crear materia</Link></div></div><aside className={styles.note}><span className="eyebrow">Un espacio a tu ritmo</span><h3>Fuentes · Aprendizaje · Estudio</h3><p>Abre una materia para leer documentos, preparar un banco o continuar una actividad dentro de tu cuaderno.</p></aside></section>
    <section aria-label="Herramientas de tu espacio"><ul className={styles.steps} role="list"><li className={styles.step}><Icon name="book" /><h2>Tu cuaderno</h2><p>Consulta materias activas o archivadas y encuentra tus fuentes.</p><Link className="text-link" href="/materias">Explorar materias →</Link></li><li className={styles.step}><Icon name="shield" /><h2>Tu cuenta</h2><p>Revisa tu identidad, el segundo factor y tus vías de acceso.</p><Link className="text-link" href="/seguridad">Cuenta y seguridad →</Link></li><li className={styles.step}><Icon name="sessions" /><h2>Tus accesos</h2><p>Consulta las sesiones registradas y cierra las que ya no necesites.</p><Link className="text-link" href="/sesiones">Revisar sesiones →</Link></li></ul></section></div></>;
}

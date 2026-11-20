import Link from "next/link";
import { PublicShell } from "../components/layout/public-shell";
import { getCoreHealth } from "../lib/server-health";
import { Icon } from "../components/ui/icon";
import styles from "../components/layout/overview.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await getCoreHealth();
  const ready = health.status === "UP";
  return <PublicShell health={ready ? "Spring disponible · UP" : "Spring no disponible · DOWN"}>
    <section className={styles.hero}><div><span className="eyebrow">Tu espacio de aprendizaje</span><h1>Un lugar para empezar.<br />Una materia a la vez.</h1>
      <p className="lead muted">Organiza tus materias y construye tu propio espacio de estudio con SIARE.</p><div className="actions"><Link href="/registro" className="button primary">Crear mi cuenta <span aria-hidden="true">→</span></Link><Link href="/login" className="button secondary">Ya tengo una cuenta</Link></div></div>
      <aside className={styles.notebook}><span className="eyebrow">Tu cuaderno de estudio</span><h2>Reúne tus fuentes.<br />Dale forma a tus ideas.</h2><p className="muted">Documentos, bancos revisados, Quiz y Crucigramas dentro de cada materia.</p></aside>
    </section><ol className={styles.steps} role="list"><li className={styles.step}><Icon name="book" /><h2>Organiza</h2><p>Crea materias y conserva sus fuentes en un solo espacio.</p></li><li className={styles.step}><Icon name="file" /><h2>Comprende</h2><p>Consulta el texto de tus documentos y revisa el material de estudio.</p></li><li className={styles.step}><Icon name="study" /><h2>Practica</h2><p>Prepara bancos revisados y responde actividades con evaluación del servidor.</p></li></ol>
    <p className="phase-note">La disponibilidad indicada corresponde al servicio de acceso y materias en el momento de esta consulta.</p></PublicShell>;
}

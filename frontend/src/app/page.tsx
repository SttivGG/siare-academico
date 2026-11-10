import Link from "next/link";
import { getCoreHealth } from "../lib/server-health";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await getCoreHealth();
  const ready = health.status === "UP";
  return <main id="contenido" tabIndex={-1} className="welcome"><header className="public-header"><Link href="/" className="brand">SIARE</Link><Link href="/login" className="button secondary">Iniciar sesión</Link></header>
    <section className="welcome-content"><span className="eyebrow">Tu espacio de aprendizaje</span><h1>Un lugar para empezar.<br />Una materia a la vez.</h1>
      <p className="lead muted">Organiza tus materias y construye tu propio espacio de estudio con SIARE.</p><div className="actions"><Link href="/registro" className="button primary">Crear mi cuenta <span aria-hidden="true">→</span></Link><Link href="/login" className="text-link">Ya tengo una cuenta</Link></div>
      <div className="welcome-note"><span className="small-label">SISTEMA INTELIGENTE DE APRENDIZAJE Y REFUERZO EDUCATIVO</span><p className="muted">Empieza por tus materias. Las herramientas de refuerzo llegarán en las próximas fases.</p></div>
    </section><footer className="public-footer"><span>Proyecto universitario · Fase 1</span><span role="status">{ready ? "Spring disponible · UP" : "Spring no disponible · DOWN"}</span></footer></main>;
}

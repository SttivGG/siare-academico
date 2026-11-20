import Link from "next/link";
import { PublicShell } from "../components/layout/public-shell";
import { getCoreHealth } from "../lib/server-health";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await getCoreHealth();
  const ready = health.status === "UP";
  return <PublicShell health={ready ? "Spring disponible · UP" : "Spring no disponible · DOWN"}>
    <section className="welcome-content"><span className="eyebrow">Tu espacio de aprendizaje</span><h1>Un lugar para empezar.<br />Una materia a la vez.</h1>
      <p className="lead muted">Organiza tus materias y construye tu propio espacio de estudio con SIARE.</p><div className="actions"><Link href="/registro" className="button primary">Crear mi cuenta <span aria-hidden="true">→</span></Link><Link href="/login" className="text-link">Ya tengo una cuenta</Link></div>
      <div className="welcome-note"><span className="small-label">SISTEMA INTELIGENTE DE APRENDIZAJE Y REFUERZO EDUCATIVO</span><p className="muted">Reúne documentos y practica con Quiz y Crucigramas creados desde bancos revisados.</p></div>
    </section></PublicShell>;
}

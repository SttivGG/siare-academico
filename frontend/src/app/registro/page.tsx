import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export const metadata = { title: "Crear cuenta" };

export default function Register() {
  return <main id="contenido" tabIndex={-1} className="auth-shell"><section className="auth-aside"><Link href="/" className="brand">SIARE</Link><div><span className="eyebrow">Empieza por lo que quieres aprender</span><h2>Haz espacio<br />para tus ideas.</h2><p>Crea tu cuenta y organiza las materias que te acompañarán este semestre.</p></div><p className="small-label">PROYECTO UNIVERSITARIO · FASE 1</p></section>
    <section className="auth-main"><div className="auth-card"><Link className="back-link" href="/">← Volver al inicio</Link><h1>Crea tu cuenta</h1><p className="muted section-intro">Tres datos para comenzar tu espacio de aprendizaje.</p><AuthForm register /></div></section></main>;
}

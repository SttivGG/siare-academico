import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export const metadata = { title: "Iniciar sesión" };

export default async function Login({ searchParams }: { searchParams: Promise<{ registro?: string; sesion?: string }> }) {
  const query = await searchParams;
  return <main id="contenido" tabIndex={-1} className="auth-shell"><section className="auth-aside"><Link href="/" className="brand">SIARE</Link><div><span className="eyebrow">Un paso más en tu aprendizaje</span><h2>Tu espacio.<br />Tu ritmo.</h2><p>Retoma tus materias y continúa donde lo dejaste.</p></div><p className="small-label">PROYECTO UNIVERSITARIO · FASE 1</p></section>
    <section className="auth-main"><div className="auth-card"><Link className="back-link" href="/">← Volver al inicio</Link><h1>Qué bueno verte de nuevo</h1><p className="muted section-intro">Inicia sesión para entrar a tus materias.</p>
      {query.registro && <p className="notice success" role="status">Tu cuenta está lista. Ya puedes iniciar sesión.</p>}
      {query.sesion && <p className="notice" role="status">Tu sesión ha caducado. Inicia sesión para continuar.</p>}
      <AuthForm /></div></section></main>;
}

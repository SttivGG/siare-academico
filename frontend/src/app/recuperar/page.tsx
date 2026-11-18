import Link from "next/link";
import { PasswordRecoveryForm } from "../../components/password-recovery-form";
export const metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };
export default function RecoveryPage() { return <main id="contenido" className="recovery-shell"><section className="auth-card"><Link className="brand" href="/">SIARE</Link><h1>Recuperar contraseña</h1><PasswordRecoveryForm /></section></main>; }

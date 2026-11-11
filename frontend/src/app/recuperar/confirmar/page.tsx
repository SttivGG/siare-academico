import Link from "next/link";
import { PasswordRecoveryForm } from "../../../components/password-recovery-form";
export const metadata = { title: "Nueva contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function CompleteRecoveryPage() { return <main id="contenido" className="recovery-shell"><section className="auth-card"><Link className="brand" href="/">SIARE</Link><h1>Establecer nueva contraseña</h1><PasswordRecoveryForm complete /></section></main>; }

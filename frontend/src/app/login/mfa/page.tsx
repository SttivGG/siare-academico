import Link from "next/link";
import { MfaPanel } from "../../../components/mfa-panel";
export const metadata = { title: "Verificación en dos pasos", robots: { index: false, follow: false } };
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ configurar?: string }> }) {
  const query = await searchParams;
  return <main id="contenido" className="recovery-shell"><section className="auth-card"><Link className="brand" href="/">SIARE</Link><h1>Verificación en dos pasos</h1><MfaPanel challenge enrollRequired={query.configurar === "1"} /><p><Link href="/login">Volver a iniciar sesión</Link></p></section></main>;
}

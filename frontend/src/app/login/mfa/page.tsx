import { AuthShell } from "../../../components/layout/auth-shell";
import Link from "next/link";
import { MfaPanel } from "../../../components/mfa-panel";
export const metadata = { title: "Verificación en dos pasos", robots: { index: false, follow: false } };
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ configurar?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Verificación en dos pasos"><MfaPanel challenge enrollRequired={query.configurar === "1"} /><p><Link href="/login">Volver a iniciar sesión</Link></p></AuthShell>;
}

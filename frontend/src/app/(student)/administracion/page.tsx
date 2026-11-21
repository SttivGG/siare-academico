import { AdministrationPanel } from "../../../components/administration-panel";
import { sessionToken } from "../../../lib/server-session";
import Link from "next/link";
import { Notice, Surface } from "../../../components/ui/primitives";
export const metadata = { title: "Administración" };
export default async function AdministrationPage() {
  const token = await sessionToken();
  const response = await fetch(`${process.env.CORE_API_URL}/api/v1/admin/overview`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (response.status === 403 || response.status === 401) return <Surface><span className="eyebrow">Permisos de la cuenta</span><header className="page-heading"><h1>Acceso administrativo restringido</h1></header>
    <Notice tone="warning">Necesitas un rol autorizado y una sesión MFA vigente. Inicia sesión de nuevo y completa el segundo factor.</Notice><div className="actions"><Link className="button primary" href="/inicio">Volver a mi espacio</Link><Link className="button secondary" href="/seguridad">Revisar seguridad</Link></div></Surface>;
  if (!response.ok) throw new Error("No se pudo comprobar la autorización administrativa.");
  const overview = await response.json();
  return <><header className="page-heading"><span className="eyebrow">{overview.identity.role}</span><h1>Administración</h1></header>
    <AdministrationPanel role={overview.identity.role} actorId={overview.identity.userId} /></>;
}

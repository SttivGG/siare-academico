import { MfaPanel } from "../../../components/mfa-panel";
import { ConnectedIdentities } from "../../../components/connected-identities";
import Link from "next/link";
import { requireStudent } from "../../../lib/server-session";
import { Surface } from "../../../components/ui/primitives";
import styles from "../../../components/ui/sections.module.css";
export const metadata = { title: "Seguridad de la cuenta" };
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ oidc?: string }> }) {
  const query = await searchParams;
  const user = await requireStudent();
  return <><header className="page-heading"><span className="eyebrow">Tu cuenta SIARE</span><h1>Seguridad de la cuenta</h1><p className="lead muted">Configura tu segundo factor y conserva una forma segura de recuperar el acceso.</p></header>
    <div className={styles.stack}><Surface className={styles.account}><span className={styles.avatar} aria-hidden="true">{user.name.slice(0, 1).toLocaleUpperCase("es")}</span><div><h2>{user.name}</h2><p className="muted">{user.email}</p></div><Link className="button secondary" href="/sesiones">Revisar sesiones</Link></Surface>
    {query.oidc === "vinculada" && <p className="notice success" role="status">Identidad vinculada a tu cuenta SIARE.</p>}
    <div className={styles.grid}><MfaPanel /><ConnectedIdentities /></div></div></>;
}

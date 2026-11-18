import { MfaPanel } from "../../../components/mfa-panel";
import { ConnectedIdentities } from "../../../components/connected-identities";
export const metadata = { title: "Seguridad de la cuenta" };
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ oidc?: string }> }) {
  const query = await searchParams;
  return <><header className="page-heading"><span className="eyebrow">Tu cuenta SIARE</span><h1>Seguridad de la cuenta</h1><p className="lead muted">Configura tu segundo factor y conserva una forma segura de recuperar el acceso.</p></header><MfaPanel />{query.oidc === "vinculada" && <p className="notice success" role="status">Identidad vinculada a tu cuenta SIARE.</p>}<ConnectedIdentities /></>;
}

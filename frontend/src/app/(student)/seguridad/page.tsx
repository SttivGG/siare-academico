import { MfaPanel } from "../../../components/mfa-panel";
export const metadata = { title: "Seguridad de la cuenta" };
export default function SecurityPage() {
  return <><header className="page-heading"><span className="eyebrow">Tu cuenta SIARE</span><h1>Seguridad de la cuenta</h1><p className="lead muted">Configura tu segundo factor y conserva una forma segura de recuperar el acceso.</p></header><MfaPanel /></>;
}

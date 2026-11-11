import { SessionsPanel } from "../../../components/sessions-panel";
export const metadata = { title: "Sesiones activas" };
export default function SessionsPage() { return <><header className="page-heading"><span className="eyebrow">Seguridad de la cuenta</span><h1>Sesiones activas</h1>
  <p className="lead muted">Revisa dónde has iniciado sesión y cierra los accesos que ya no necesitas.</p></header><SessionsPanel /></>; }

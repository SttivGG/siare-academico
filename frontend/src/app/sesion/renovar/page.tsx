import { AuthShell } from "../../../components/layout/auth-shell";
import { SessionRenewal } from "../../../components/session-renewal";
export const metadata = { title: "Renovar sesión" };
export default function RenewPage() { return <AuthShell title="Renovar sesión"><SessionRenewal /></AuthShell>; }

import { AuthShell } from "../../../components/layout/auth-shell";
import Link from "next/link";
import { PasswordRecoveryForm } from "../../../components/password-recovery-form";
export const metadata = { title: "Nueva contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function CompleteRecoveryPage() { return <AuthShell title="Establecer nueva contraseña"><PasswordRecoveryForm complete /></AuthShell>; }

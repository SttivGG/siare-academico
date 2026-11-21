import { AuthShell } from "../../components/layout/auth-shell";
import Link from "next/link";
import { PasswordRecoveryForm } from "../../components/password-recovery-form";
export const metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };
export default function RecoveryPage() { return <AuthShell title="Recuperar contraseña"><PasswordRecoveryForm /></AuthShell>; }

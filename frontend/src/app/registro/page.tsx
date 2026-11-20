import { AuthShell } from "../../components/layout/auth-shell";
import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { FederatedLogin } from "../../components/federated-login";

export const metadata = { title: "Crear cuenta" };

export default function Register() {
  return <AuthShell title="Crea tu cuenta" intro="Tres datos para comenzar tu espacio de aprendizaje.">
      <AuthForm register /><hr /><FederatedLogin /><p className="hint">Si tu correo ya tiene una cuenta SIARE, inicia sesión y vincula el proveedor desde Seguridad.</p></AuthShell>;
}

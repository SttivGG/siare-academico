import { AuthShell } from "../../components/layout/auth-shell";
import Link from "next/link";
import { FederatedLogin } from "../../components/federated-login";
import { diagnosticCode, oidcNotice } from "../../lib/oidc-policy";
import { AuthForm } from "../../components/auth-form";

export const metadata = { title: "Iniciar sesión" };

export default async function Login({ searchParams }: { searchParams: Promise<{ registro?: string; sesion?: string; oidc?: string; diagnostico?: string; referencia?: string; copia?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Qué bueno verte de nuevo" intro="Inicia sesión para entrar a tus materias.">
      {query.registro && <p className="notice success" role="status">Tu cuenta está lista. Ya puedes iniciar sesión.</p>}
      {query.sesion && <p className="notice" role="status">Tu sesión ha caducado. Inicia sesión para continuar.</p>}
      {query.copia === 'error-al-eliminar' && <p className="notice error" role="alert">La sesión está cerrada, pero el navegador no permitió confirmar la eliminación de la copia local cifrada. Sigue bloqueada. Al entrar con la misma cuenta, puedes descartarla desde la materia. Si compartes el dispositivo, elimina los datos de este sitio desde el navegador.</p>}
      {query.oidc && <div className="notice error" role="alert"><p>{oidcNotice(query.oidc)}</p>{query.diagnostico && diagnosticCode(query.diagnostico) === query.diagnostico && <p className="hint">Diagnóstico: {query.diagnostico}{query.referencia && /^[a-f0-9-]{36}$/.test(query.referencia) ? ` · Referencia: ${query.referencia}` : ""}</p>}{query.oidc === "vincular" && <Link href="/login#credenciales">Entrar con mi cuenta para vincular desde Seguridad</Link>}</div>}
      <div id="credenciales"><AuthForm /></div><hr /><FederatedLogin /></AuthShell>;
}

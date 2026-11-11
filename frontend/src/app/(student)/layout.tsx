import { StudentNav } from "../../components/student-nav";
import { requireStudent, sessionToken } from "../../lib/server-session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  const identity = await fetch(`${process.env.CORE_API_URL}/api/v1/users/me/identity`, {
    headers: { Authorization: `Bearer ${await sessionToken()}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!identity.ok) throw new Error("No se pudo comprobar la identidad de la sesión.");
  const access = await identity.json();
  return <div className="student-shell"><StudentNav role={access.role} /><main id="contenido" tabIndex={-1} className="student-main">{children}</main><footer className="student-footer">SIARE · Sistema Inteligente de Aprendizaje y Refuerzo Educativo</footer></div>;
}

import { StudentNav } from "../../components/student-nav";
import { requireStudent } from "../../lib/server-session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <div className="student-shell"><StudentNav /><main id="contenido" tabIndex={-1} className="student-main">{children}</main><footer className="student-footer">SIARE · Sistema Inteligente de Aprendizaje y Refuerzo Educativo</footer></div>;
}

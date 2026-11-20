import { AppShell } from "../../components/layout/app-shell";
import { requireStudent, sessionToken } from "../../lib/server-session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const identity = await fetch(`${process.env.CORE_API_URL}/api/v1/users/me/identity`, {
    headers: { Authorization: `Bearer ${await sessionToken()}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!identity.ok) throw new Error("No se pudo comprobar la identidad de la sesión.");
  const access = await identity.json();
  return <AppShell role={access.role} user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}

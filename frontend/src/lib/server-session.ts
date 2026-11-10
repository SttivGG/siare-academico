import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const secureCookie = () => process.env.SESSION_COOKIE_SECURE !== "false";
export const sessionName = () => secureCookie() ? "__Host-siare_session" : "siare_session";

export async function sessionToken() {
  return (await cookies()).get(sessionName())?.value;
}

export async function requireStudent(): Promise<{ id: string; name: string; email: string }> {
  const token = await sessionToken();
  if (!token) redirect("/login");
  let response: Response;
  try {
    response = await fetch(`${process.env.CORE_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
  } catch { throw new Error("No se pudo conectar con SIARE. Vuelve a intentarlo."); }
  if (response.status === 401) redirect("/login?sesion=expirada");
  if (!response.ok) throw new Error("No se pudo comprobar la sesión. Vuelve a intentarlo.");
  return response.json();
}

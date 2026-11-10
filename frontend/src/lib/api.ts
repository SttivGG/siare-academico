export type Student = { id: string; name: string; email: string };
export type Subject = { id: string; name: string; description: string | null; archived: boolean; createdAt: string; updatedAt: string };

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) { super(message); }
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/bff/${path}`, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(method !== "GET" ? { "X-SIARE-CSRF": "1" } : {}) },
      ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch { throw new ApiError(503, "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo."); }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/")) window.location.assign("/login?sesion=expirada");
    throw new ApiError(response.status, data.message ?? "No se pudo completar la solicitud.", data.fields ?? {});
  }
  return data;
}

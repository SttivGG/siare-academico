export type CoreHealth = { status: "UP" | "DOWN" };

/** Called by server components/routes only; never expose the internal URL to clients. */
export async function checkCoreHealth(baseUrl: string | undefined): Promise<CoreHealth> {
  if (!baseUrl) return { status: "DOWN" };
  try {
    const response = await fetch(new URL("/health", baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: "DOWN" };
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "status" in body && body.status === "UP") {
      return { status: "UP" };
    }
  } catch {
    // Network, timeout and invalid payloads are real failures, with no internal details leaked.
  }
  return { status: "DOWN" };
}

"use client";

let renewing: Promise<boolean> | undefined;

export async function renewSession(): Promise<boolean> {
  if (renewing) return renewing;
  const refresh = async () => {
    const response = await fetch("/api/bff/auth/refresh", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-SIARE-CSRF": "1" }, body: "{}",
    });
    return response.ok;
  };
  // Serialize across tabs as well as concurrent requests in this document.
  const job: Promise<boolean> = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks) return await navigator.locks.request("siare-session-renewal", async () => await refresh());
    return await refresh();
  })();
  renewing = job;
  try { return await job; } finally { renewing = undefined; }
}

export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401 || !(await renewSession())) return response;
  return fetch(input, init);
}

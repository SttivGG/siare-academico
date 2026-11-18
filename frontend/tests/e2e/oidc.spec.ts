import { test, expect } from "@playwright/test";

test("unconfigured providers are disabled, callbacks fail safely and CSRF is enforced", async ({ page, baseURL }) => {
  await page.route("**/api/bff/auth/oidc/providers", route => route.fulfill({ json: [{ provider: "google", enabled: false }, { provider: "gitlab", enabled: false }] }));
  await page.goto("/login");
  for (const name of ["Continuar con Google", "Continuar con GitLab"]) await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Microsoft/ })).toHaveCount(0);
  await expect(page.getByText("Proveedor no configurado.", { exact: true })).toHaveCount(2);
  expect((await page.request.post("/api/oidc/start", { data: { provider: "google" } })).status()).toBe(403);
  expect((await page.request.post("/api/oidc/start", { headers: { Origin: baseURL!, "X-SIARE-CSRF": "1" }, data: { provider: "google", redirectUri: "https://evil.example" } })).status()).toBe(400);
  expect((await page.request.post("/api/bff/auth/oidc/complete", { headers: { Origin: baseURL!, "X-SIARE-CSRF": "1" }, data: {} })).status()).toBe(404);
  const callback = await page.request.get(`/api/oidc/callback/google?state=${"x".repeat(43)}&code=controlled`, { maxRedirects: 0 });
  expect(callback.status()).toBe(303); expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
  const destination = new URL(callback.headers().location);
  expect(destination.origin).toBe(baseURL); expect(destination.pathname).toBe("/login");
  expect(destination.searchParams.get("oidc")).toBe("contexto");
  expect(destination.searchParams.get("diagnostico")).toBe("OIDC_BROWSER_CONTEXT_MISSING");
  await page.goto("/login?oidc=contexto"); await expect(page.getByRole("alert").filter({ hasText: "La conexión venció" })).toContainText("Vuelve a intentarlo");
  expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../.cache/h2b2-login-${test.info().project.name}.png`, fullPage: true });
});
test("registration offers Google and GitLab and email conflicts direct users to an authenticated link", async ({ page }) => {
  await page.route("**/api/bff/auth/oidc/providers", route => route.fulfill({ json: [{ provider: "google", enabled: true }, { provider: "gitlab", enabled: true }] }));
  await page.goto("/registro");
  await expect(page.getByRole("button", { name: "Continuar con Google", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continuar con GitLab", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Microsoft/ })).toHaveCount(0);
  await expect(page.getByText("Si tu correo ya tiene una cuenta SIARE", { exact: false })).toBeVisible();
  expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../.cache/h2b2-gitlab-register-${test.info().project.name}.png`, fullPage: true });
  await page.goto("/login?oidc=vincular&diagnostico=OIDC_EMAIL_LINK_REQUIRED");
  await expect(page.getByRole("alert").filter({ hasText: "Ya existe una cuenta" })).toContainText("Inicia sesión y vincula el proveedor desde Seguridad");
  await expect(page.getByRole("link", { name: "Entrar con mi cuenta para vincular desde Seguridad" })).toHaveAttribute("href", "/login#credenciales");
});

test("GitLab buttons start the selected provider from login and registration and report failures accessibly", async ({ page }) => {
  await page.route("**/api/bff/auth/oidc/providers", route => route.fulfill({ json: [{ provider: "google", enabled: true }, { provider: "gitlab", enabled: true }] }));
  let selected: unknown;
  await page.route("**/api/oidc/start", route => {
    selected = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { message: "No se pudo iniciar la conexión.", code: "OIDC_DISCOVERY_FAILED" } });
  });
  for (const path of ["/login", "/registro"]) {
    await page.goto(path);
    selected = undefined;
    await page.getByRole("button", { name: "Continuar con GitLab", exact: true }).click();
    await expect.poll(() => selected).toEqual({ provider: "gitlab", link: false, confirmed: false });
    await expect(page.getByRole("alert").filter({ hasText: "OIDC_DISCOVERY_FAILED" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar con Google", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continuar con GitLab", exact: true })).toBeEnabled();
    expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

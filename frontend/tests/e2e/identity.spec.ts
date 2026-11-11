import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("renews from HttpOnly refresh cookie, enforces admin denial and revokes other sessions", async ({ page, browser, baseURL }) => {
  const origin = baseURL!;
  const headers = { Origin: origin, "X-SIARE-CSRF": "1" };
  const credentials = { email: `identity-${randomUUID()}@example.test`, password: `Una frase privada ${randomUUID()}` };
  expect((await page.request.post("/api/bff/auth/register", { headers, data: { ...credentials, name: "Identidad prueba" } })).status()).toBe(201);
  expect((await page.request.post("/api/bff/auth/login", { headers, data: credentials })).status()).toBe(200);
  const second = await browser.newContext({ baseURL: origin });
  try {
    expect((await second.request.post("/api/bff/auth/login", { headers, data: credentials })).status()).toBe(200);
    const before = await page.context().cookies();
    expect(before.filter(c => c.name.includes("siare_") && c.httpOnly)).toHaveLength(2);
    const oldRefresh = before.find(c => c.name.includes("refresh"))!.value;
    await page.context().clearCookies({ name: "siare_session" });
    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: "Hola, Identidad prueba." })).toBeVisible();
    const after = await page.context().cookies();
    expect(after.find(c => c.name.includes("refresh"))!.value).not.toBe(oldRefresh);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.goto("/administracion");
    await expect(page.getByRole("heading", { name: "Acceso administrativo restringido" })).toBeVisible();
    expect((await page.request.get("/api/bff/admin/users")).status()).toBe(403);
    await page.getByRole("link", { name: "Sesiones", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sesiones activas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar esta sesión", exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Cerrar otras sesiones" }).click();
    await expect(page.getByRole("status")).toContainText("se han cerrado");
    await expect(page.getByRole("button", { name: "Cerrar esta sesión", exact: true })).toHaveCount(1);
    expect((await second.request.get("/api/bff/users/me")).status()).toBe(401);
    expect((await second.request.post("/api/bff/auth/refresh", { headers, data: {} })).status()).toBe(401);
    expect((await page.request.post("/api/bff/auth/refresh", { data: {} })).status()).toBe(403);
    await page.screenshot({ path: `../.cache/h2a-sessions-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/bff/users/me/sessions")).status()).toBe(401);
  } finally { await second.close(); }
});

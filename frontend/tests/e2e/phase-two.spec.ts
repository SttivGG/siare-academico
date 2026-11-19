import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("carga, procesamiento, texto y descarga desde la materia", async ({ page, context }, testInfo) => {
  const email = `documents-browser-${randomUUID()}@example.test`;
  const password = `Synthetic-${randomUUID()}`;
  const headers = { Origin: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100", "X-SIARE-CSRF": "1" };
  const registration = await page.request.post("/api/bff/auth/register", { headers, data: { name: "Documentos de prueba", email, password } });
  expect(registration.status()).toBe(201);
  const login = await page.request.post("/api/bff/auth/login", { headers, data: { email, password } });
  expect(login.status()).toBe(200);
  const subject = await page.request.post("/api/bff/subjects", { headers, data: { name: `Materia documental ${testInfo.project.name}` } });
  expect(subject.status()).toBe(201);
  const id = (await subject.json()).id;
  await page.goto(`/materias/${id}`);
  const panel = page.getByRole("region", { name: "Documentos de la materia" });
  await expect(panel.getByText("Todavía no hay documentos")).toBeVisible();
  await panel.getByLabel("Seleccionar documento").setInputFiles({ name: "legacy.doc", mimeType: "application/msword", buffer: Buffer.from("invalid") });
  await expect(panel.getByRole("alert")).toContainText("Formato no soportado");
  for (const [name, buffer, code, message] of [
    ["corrupt.pdf", Buffer.from("%PDF-corrupt"), "CORRUPT_DOCUMENT", "El archivo está dañado"],
  ] as [string, Buffer, string, string][]) {
    await panel.getByLabel("Seleccionar documento").setInputFiles({ name, mimeType: "application/pdf", buffer });
    const pending = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/api/files/subjects/${id}/documents`));
    await panel.getByRole("button", { name: "Subir documento" }).click();
    const response = await pending;
    expect(response.status()).toBe(422);
    expect((await response.json()).code).toBe(code);
    await expect(panel.getByRole("alert")).toContainText(message);
    console.log(`Document upload: POST ${response.url()}; Origin=${(await response.request().allHeaders()).origin}; HTTP 422 ${code}; action=Subir documento`);
    await expect(panel.getByRole("heading", { name })).toHaveCount(0);
  }
  const bytes = readFileSync(new URL("../../../.cache/phase2-fixtures/academic.pdf", import.meta.url));
  await panel.getByLabel("Seleccionar documento").setInputFiles({ name: "academic.pdf", mimeType: "application/pdf", buffer: bytes });
  await panel.getByRole("button", { name: "Subir documento" }).click();
  await expect(panel.getByRole("heading", { name: "academic.pdf" })).toBeVisible();
  await expect(panel.getByText("Archivo guardado.", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Descargar academic.pdf" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Usar como fuente/ })).toHaveCount(0);
  await panel.getByRole("button", { name: "Procesar", exact: true }).click();
  await expect(panel.getByText("Texto disponible", { exact: true })).toBeVisible({ timeout: 60_000 });
  await panel.getByRole("button", { name: "Ver texto", exact: true }).click();
  await expect(panel.getByText("Aprender ciencias con SIARE", { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Página 1" })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Descargar academic.pdf" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("academic.pdf");
  expect(readFileSync((await download.path())!)).toEqual(bytes);
  if (process.env.SIARE_TEST_PDF) {
    const original = readFileSync(process.env.SIARE_TEST_PDF);
    const name = "Guia_Estudio_MongoDB_Aggregate_Solucionario.pdf";
    await panel.getByLabel("Seleccionar documento").setInputFiles({ name, mimeType: "application/pdf", buffer: original });
    await panel.getByRole("button", { name: "Subir documento", exact: true }).click();
    const row = panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(row.getByText("Original conservado en cuarentena.", { exact: false })).toBeVisible();
    await expect(row.getByRole("button", { name: "Descargar", exact: false })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /Usar como fuente/ })).toHaveCount(0);
    await row.getByRole("button", { name: "Procesar", exact: true }).click();
    await expect(row.getByText("Texto disponible", { exact: true })).toBeVisible({ timeout: 60_000 });
    await row.getByRole("button", { name: /Usar como fuente/ }).click();
    await expect(row.getByRole("button", { name: /Fuente seleccionada/ })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.locator(".document-list > li > h3")).toHaveText([name, "academic.pdf"]);
    await row.getByRole("button", { name: "Ver texto", exact: true }).click();
    await expect(row.getByText("Su firma y su procedencia no han sido verificadas.", { exact: false })).toBeVisible();
    await expect(row.getByRole("heading", { name: "Página 13", exact: true })).toBeVisible();
    await expect(row.locator(".document-preview")).toContainText(/aggregate/i);
    await expect(row.locator("iframe, object, embed")).toHaveCount(0);
    const pendingDownload = page.waitForEvent("download");
    await row.getByRole("button", { name: `Descargar ${name}` }).click();
    const saved = await pendingDownload;
    expect(createHash("sha256").update(readFileSync((await saved.path())!)).digest("hex"))
      .toBe("66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e");
  }
  expect((await context.cookies()).find(c => c.name === "siare_session")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../.cache/phase2-documents-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Archivar materia", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar archivo" }).click();
  await expect(panel.getByText("La materia está archivada.", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Subir documento" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Descargar academic.pdf" })).toBeVisible();
});

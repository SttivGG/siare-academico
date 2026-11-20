import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { openAccount } from './navigation';

const phrase = 'Frase local de pruebas H6 tres';
const question = { id: 'q1', prompt: '¿Cuánto es dos más dos?', options: [{ id: 'a', text: 'cuatro' }, { id: 'b', text: 'cinco' }], correctOptionId: 'a', explanation: 'Suma revisada.', topic: 'Repaso' };
const bank = { validated: true, questions: [question, { ...question, id: 'q2', prompt: 'Segunda pregunta sintética' }], words: [{ id: 'w1', answer: 'SOL', clue: 'Estrella del sistema solar.', topic: 'Repaso' }, { id: 'w2', answer: 'LUNA', clue: 'Satélite de la Tierra.', topic: 'Repaso' }] };
const headers = (origin: string) => ({ Origin: origin, 'X-SIARE-CSRF': '1' });
async function setup(page: Page, origin: string) {
  const credentials = { name: 'Estudiante H6-3', email: `h63-${randomUUID()}@example.test`, password: `Contraseña sintética ${randomUUID()}` };
  expect((await page.request.post('/api/bff/auth/register', { headers: headers(origin), data: credentials })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers: headers(origin), data: { email: credentials.email, password: credentials.password } })).status()).toBe(200);
  const response = await page.request.post('/api/bff/subjects', { headers: headers(origin), data: { name: 'Cuaderno abierto H6-3', description: 'Contenido sintético de verificación.' } }); expect(response.status()).toBe(201);
  const id = (await response.json()).id;
  async function create(type = 'QUIZ') {
    const response = await page.request.post(`/api/bff/subjects/${id}/activities`, { headers: headers(origin), data: { type, topic: 'Repaso', count: 2, gridSize: 15, bank } }); expect(response.status()).toBe(201); return response.json();
  }
  return { id, credentials, create };
}
async function panel(page: Page, name: 'Fuentes' | 'Aprendizaje' | 'Estudio') {
  await expect(page.locator('[data-workspace-layout="a"]')).toBeVisible();
  if (await page.getByRole('navigation', { name: 'Paneles del cuaderno' }).isVisible()) await page.getByRole('button', { name, exact: true }).click();
}
async function tool(page: Page, name: 'Preparar banco' | 'Catálogo' | 'Intentos' | 'Lectura') { await panel(page, 'Aprendizaje'); await page.getByRole('button', { name, exact: true }).click(); }
async function open(page: Page, id: string) { await tool(page, 'Catálogo'); if ((await page.locator('.catalog-picker').getAttribute('open')) === null) await page.locator('.catalog-picker > summary').click(); await page.locator(`.activity-card[data-activity-id="${id}"]`).click(); await expect(page.locator(`.activity-card[data-activity-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true'); }
async function enable(page: Page) { await page.getByRole('button', { name: 'Habilitar recuperación local', exact: true }).click(); await page.getByLabel('Frase local de recuperación').fill(phrase); await page.getByLabel('Autorizo una copia local cifrada').check(); await page.getByRole('button', { name: 'Habilitar copia cifrada', exact: true }).click(); await expect(page.getByRole('button', { name: 'Guardar copia ahora' })).toBeVisible(); }
async function save(page: Page) { await page.getByRole('button', { name: 'Guardar copia ahora' }).click(); await expect(page.locator('.academic-recovery > p')).toContainText('Copia cifrada guardada'); }
async function reload(page: Page) { page.once('dialog', dialog => dialog.accept()); await page.reload(); }
async function unlock(page: Page, value = phrase) { await page.getByRole('button', { name: 'Recuperar copia cifrada', exact: true }).click(); await page.getByLabel('Frase local de recuperación').fill(value); await page.getByRole('button', { name: 'Desbloquear y recuperar', exact: true }).click(); }
function pdf() {
  const stream = 'BT /F1 16 Tf 50 750 Td (SOL LUNA. Texto sintetico H6.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n'; const offsets = [0]; for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; } const xref = Buffer.byteLength(output); return Buffer.from(output + `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
async function source(request: APIRequestContext, origin: string, id: string, name: string, buffer = pdf()) {
  const response = await request.post(`/api/files/subjects/${id}/documents`, { headers: headers(origin), multipart: { file: { name, mimeType: 'application/pdf', buffer } } }); expect(response.status()).toBe(201);
  const document = await response.json(); expect((await request.post(`/api/bff/documents/${document.documentId}/process`, { headers: headers(origin), data: {} })).status()).toBeLessThan(300);
  await expect.poll(async () => (await (await request.get(`/api/bff/subjects/${id}/documents`)).json()).find((d: { documentId: string }) => d.documentId === document.documentId)?.status, { timeout: 60_000 }).toBe('READY'); return document;
}

test('ST-02: source-specific drafts and human review cannot migrate to another source', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); const a = await source(page.request, baseURL!, id, 'fuente-a.pdf'), b = await source(page.request, baseURL!, id, 'fuente-b.pdf');
  await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Tema exacto del banco').fill('Repaso'); await page.getByLabel('Editar banco JSON').fill(JSON.stringify(bank)); await page.getByRole('button', { name: 'Validar y revisar banco' }).click(); await page.getByLabel('He revisado las preguntas', { exact: false }).check();
  await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Usar como fuente fuente-a.pdf', exact: true }).click(); await panel(page, 'Aprendizaje'); await page.getByLabel('Editar banco JSON').fill('{"fuente":"A"}');
  await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Usar como fuente fuente-b.pdf', exact: true }).click(); await panel(page, 'Aprendizaje'); await page.getByLabel('Editar banco JSON').fill('{"fuente":"B"}');
  await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Usar como fuente fuente-a.pdf', exact: true }).click(); await panel(page, 'Aprendizaje'); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"fuente":"A"}');
  await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Quitar selección de fuente' }).click(); await panel(page, 'Aprendizaje'); await expect(page.getByLabel('Editar banco JSON')).toHaveValue(JSON.stringify(bank)); await expect(page.getByRole('button', { name: 'Crear Quiz revisado' })).toBeDisabled();
  expect(a.documentId).not.toBe(b.documentId);
});
test('ST-03: Quiz answers and current question survive tools; activities do not share answers', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create(), b = await create(); await page.goto(`/materias/${id}`); await open(page, a.activityId);
  await page.getByRole('radio', { name: 'cuatro', exact: true }).check(); await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await tool(page, 'Preparar banco'); await panel(page, 'Fuentes'); await panel(page, 'Estudio'); await page.getByRole('button', { name: 'Quiz y Crucigrama', exact: true }).click(); await expect(page.getByText('Pregunta 2 de 2', { exact: false })).toBeVisible();
  await open(page, b.activityId); await expect(page.getByRole('radio', { name: 'cuatro', exact: true })).not.toBeChecked(); await open(page, a.activityId); await expect(page.getByText('Pregunta 2 de 2', { exact: false })).toBeVisible(); await page.getByRole('button', { name: 'Anterior', exact: true }).click(); await expect(page.getByRole('radio', { name: 'cuatro', exact: true })).toBeChecked(); await expect(page.locator('.activity-player')).toHaveCount(1);
});
test('ST-04: crossword cells and direction survive reading, tools and mobile viewport', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create('CROSSWORD'); await page.goto(`/materias/${id}`); await open(page, a.activityId); const first = page.locator('.crossword-cell input').first(); await first.fill('S'); await page.getByRole('button', { name: 'Entrada: horizontal' }).click(); await tool(page, 'Lectura'); await panel(page, 'Fuentes'); await page.setViewportSize({ width: 390, height: 844 }); await tool(page, 'Catálogo'); await expect(first).toHaveValue('S'); await expect(page.getByRole('button', { name: 'Entrada: vertical' })).toBeVisible(); await expect(page.locator('.activity-player')).toHaveCount(1);
});
test('ST-09: encrypted recovery restores crossword cells, direction and the reviewed manual bank', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create('CROSSWORD'); await page.goto(`/materias/${id}`); await open(page, a.activityId); await page.locator('.crossword-cell input').first().fill('S'); await page.getByRole('button', { name: 'Entrada: horizontal' }).click();
  await tool(page, 'Preparar banco'); await page.getByLabel('Tema exacto del banco').fill('Repaso'); await page.getByLabel('Editar banco JSON').fill(JSON.stringify(bank)); await page.getByRole('button', { name: 'Validar y revisar banco' }).click(); await page.getByLabel('He revisado las preguntas', { exact: false }).check(); await enable(page); await save(page); await reload(page); await unlock(page); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByLabel('Editar banco JSON')).toHaveValue(JSON.stringify(bank)); await expect(page.getByLabel('He revisado las preguntas', { exact: false })).toBeChecked(); await tool(page, 'Catálogo'); await expect(page.locator('.crossword-cell input').first()).toHaveValue('S'); await expect(page.getByRole('button', { name: 'Entrada: vertical' })).toBeVisible();
});
test('recovery: denied writes never announce saved and retain the current bank', async ({ page, baseURL }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"cuota":"conservar"}'); await enable(page); await save(page);
  // Deny the IndexedDB write at its actual boundary after a successful initial copy.
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; Object.defineProperty(IDBObjectStore.prototype, 'put', { configurable: true, value: function(...args: Parameters<IDBObjectStore['put']>) { if (this.name === 'copies') throw new DOMException('quota', 'QuotaExceededError'); return original.apply(this, args); } }); });
  await page.getByLabel('Editar banco JSON').fill('{"cuota":"cambio en memoria"}'); await page.getByRole('button', { name: 'Guardar copia ahora' }).click(); await expect(page.locator('.academic-recovery > p')).not.toContainText('guardada'); await expect(page.locator('.academic-recovery > p')).toContainText('memoria'); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"cuota":"cambio en memoria"}'); expect(errors).toEqual([]);
});
test('ST-05: theme and responsive panel changes preserve the reviewed bank', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Tema exacto del banco').fill('Repaso'); await page.getByLabel('Editar banco JSON').fill(JSON.stringify(bank)); await page.getByRole('button', { name: 'Validar y revisar banco' }).click(); await page.getByLabel('He revisado las preguntas', { exact: false }).check();
  await page.locator('summary').filter({ hasText: /^Tema$/ }).click(); await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark'); await page.keyboard.press('Escape');
  for (const width of [1440, 1024, 390, 320, 1920]) { await page.setViewportSize({ width, height: 900 }); await expect(page.getByLabel('Editar banco JSON')).toHaveValue(JSON.stringify(bank)); await expect(page.getByLabel('He revisado las preguntas', { exact: false })).toBeChecked(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await tool(page, 'Intentos'); await tool(page, 'Preparar banco'); await expect(page.getByLabel('He revisado las preguntas', { exact: false })).toBeChecked();
});
test('ST-06/09: Spring saves, HTTP response is lost, reload restores the exact frozen retry', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create(); await page.goto(`/materias/${id}`); await open(page, a.activityId); await page.getByRole('radio', { name: 'cuatro', exact: true }).check(); await enable(page);
  let first = true; let saved: { attemptId: string }; const bodies: string[] = [];
  await page.route(`**/api/bff/activities/${a.activityId}/submissions`, async route => { bodies.push(route.request().postData()!); const response = await route.fetch(); if (first) { first = false; saved = await response.json(); await route.fulfill({ status: 503, json: { message: 'Respuesta perdida controlada H6-3' } }); } else await route.fulfill({ response }); });
  await page.getByRole('button', { name: 'Enviar respuestas', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reintentar envío' })).toBeVisible(); await tool(page, 'Preparar banco'); await save(page); await reload(page);
  await unlock(page); await expect(page.getByRole('dialog')).toHaveCount(0); expect(bodies).toHaveLength(1); await tool(page, 'Catálogo'); await expect(page.getByRole('radio').first()).toBeDisabled(); await page.getByRole('button', { name: 'Reintentar envío' }).click(); await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toContainText(saved!.attemptId); expect(bodies).toHaveLength(2); expect(bodies[0]).toBe(bodies[1]);
  expect((await (await page.request.get(`/api/bff/activities/${a.activityId}/submissions/${saved!.attemptId}`)).json()).attemptId).toBe(saved!.attemptId);
  await save(page); await reload(page); await unlock(page); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toContainText(saved!.attemptId); expect(bodies).toHaveLength(2);
});
test('ST-07: double click and late response remain associated with the original activity', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create(), b = await create(); await page.goto(`/materias/${id}`); await open(page, a.activityId); let requests = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/bff/activities/${a.activityId}/submissions`, async route => { requests++; const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.getByRole('button', { name: 'Enviar respuestas', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); }); await expect.poll(() => requests).toBe(1); await tool(page, 'Preparar banco'); await open(page, b.activityId); release(); await expect(page.getByRole('radio').first()).toBeEnabled(); await open(page, a.activityId); await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toBeVisible(); expect(requests).toBe(1);
});
test('ST-08: cancelling navigation preserves draft and answers without sending or archiving', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); const a = await create(); await page.goto(`/materias/${id}`); await open(page, a.activityId); await page.getByRole('radio', { name: 'cuatro', exact: true }).check(); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"draft":"ST08"}'); let mutations = 0; page.on('request', r => { if (r.method() !== 'GET' && /submissions|archive/.test(r.url())) mutations++; });
  await page.getByRole('link', { name: '← Mis materias', exact: true }).click(); await page.getByRole('dialog', { name: 'Salir del cuaderno' }).getByRole('button', { name: 'Seguir trabajando' }).click(); await expect(page).toHaveURL(new RegExp(`/materias/${id}$`)); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"draft":"ST08"}'); await tool(page, 'Catálogo'); await expect(page.getByRole('radio', { name: 'cuatro', exact: true })).toBeChecked(); expect(mutations).toBe(0);
});
test('ST-08/09: an authorized internal departure and return preserve the in-memory bank', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"volver":"misma sesión"}');
  await page.getByRole('link', { name: '← Mis materias', exact: true }).click(); await page.getByRole('dialog', { name: 'Salir del cuaderno' }).getByRole('button', { name: 'Continuar navegación', exact: true }).click(); await expect(page).toHaveURL(/\/materias$/); await page.getByRole('link', { name: 'Cuaderno abierto H6-3', exact: true }).click(); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"volver":"misma sesión"}');
});
test('ST-09: wrong phrase, corrupt copy and denied storage preserve the live draft', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"borrador":"recuperable"}'); await enable(page); await save(page); await reload(page); await unlock(page, 'Frase equivocada de pruebas'); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Frase incorrecta'); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"en":"memoria"}');
  await page.evaluate(async () => { await new Promise<void>((resolve, reject) => { const request = indexedDB.open('siare-academic-recovery', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('copies', 'readwrite'), store = tx.objectStore('copies'), read = store.openCursor(); read.onsuccess = () => { const c = read.result; if (c) { const bytes = new Uint8Array(c.value.ciphertext); bytes[0] ^= 1; c.update({ ...c.value, ciphertext: bytes.buffer }); } }; tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }); });
  await page.getByRole('button', { name: 'Recuperar copia cifrada', exact: true }).click(); await page.getByLabel('Frase local de recuperación').fill(phrase); await page.getByLabel('Reemplazar el trabajo actual').check(); await page.getByRole('button', { name: 'Desbloquear y recuperar', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('copia dañada'); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"en":"memoria"}');
  await page.evaluate(() => { Object.defineProperty(indexedDB, 'open', { configurable: true, value: () => { throw new DOMException('denied', 'SecurityError'); } }); }); await page.getByRole('button', { name: 'Recuperar copia cifrada', exact: true }).click(); await page.getByLabel('Frase local de recuperación').fill(phrase); await page.getByLabel('Reemplazar el trabajo actual').check(); await page.getByRole('button', { name: 'Desbloquear y recuperar', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"en":"memoria"}');
});
test('ST-10: logout purges account A copies and memory before account B enters', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"privado":"cuenta A"}'); await enable(page); await save(page); await openAccount(page); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  const count = await page.evaluate(() => new Promise<number>(resolve => { const request = indexedDB.open('siare-academic-recovery', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('copies'), count = tx.objectStore('copies').count(); count.onsuccess = () => { db.close(); resolve(count.result); }; }; })); expect(count).toBe(0);
  const b = await setup(page, baseURL!); await page.goto(`/materias/${b.id}`); await expect(page.getByRole('button', { name: 'Recuperar copia cifrada' })).toHaveCount(0); await tool(page, 'Preparar banco'); await expect(page.getByLabel('Editar banco JSON')).not.toHaveValue('{"privado":"cuenta A"}'); expect((await page.request.get(`/api/bff/subjects/${id}`)).status()).toBe(403);
});
test('recovery: logout reports a denied purge while closing the server session', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"cierre":"error de almacenamiento"}'); await enable(page); await save(page);
  await page.evaluate(() => { Object.defineProperty(indexedDB, 'open', { configurable: true, value: () => { throw new DOMException('denied', 'SecurityError'); } }); }); await openAccount(page); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await expect(page).toHaveURL(/\/login\?copia=error-al-eliminar/); await expect(page.getByRole('alert').filter({ hasText: 'La sesión está cerrada' })).toContainText('La sesión está cerrada'); expect((await page.context().cookies()).some(c => c.name === 'siare_session' || c.name === 'siare_refresh')).toBe(false);
});

test('recovery: competing tabs cannot overwrite a saved copy', async ({ page, context, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"pestaña":"A"}'); await enable(page); await save(page);
  const other = await context.newPage(); await other.goto(`/materias/${id}`); await unlock(other); await expect(other.getByRole('dialog').getByRole('alert')).toContainText('Otra pestaña'); await other.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"pestaña":"A"}'); await other.close();
});

test('ST-10: a retained encrypted A copy is unavailable to B and restores only after A reauthenticates', async ({ page, baseURL }) => {
  const a = await setup(page, baseURL!); await page.goto(`/materias/${a.id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"cuenta":"solo A"}'); await enable(page); await save(page);
  // Controlled server logout simulates expiry/account switching without the UI purge path.
  expect((await page.request.post('/api/bff/auth/logout', { headers: headers(baseURL!), data: {} })).status()).toBe(200);
  const b = await setup(page, baseURL!); page.once('dialog', d => d.accept()); await page.goto(`/materias/${b.id}`); await expect(page.getByRole('button', { name: 'Recuperar copia cifrada' })).toHaveCount(0); expect((await page.request.get(`/api/bff/subjects/${a.id}`)).status()).toBe(403);
  expect((await page.request.post('/api/bff/auth/logout', { headers: headers(baseURL!), data: {} })).status()).toBe(200); expect((await page.request.post('/api/bff/auth/login', { headers: headers(baseURL!), data: { email: a.credentials.email, password: a.credentials.password } })).status()).toBe(200); await page.goto(`/materias/${a.id}`); await unlock(page); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"cuenta":"solo A"}');
});

test('DT-01: real catalog contract has no date and never renders a fictitious one', async ({ page, baseURL }) => {
  const { id, create } = await setup(page, baseURL!); await create(); const catalog = await (await page.request.get(`/api/bff/subjects/${id}/activities?limit=20`)).json(); expect(Object.keys(catalog.items[0]).sort()).toEqual(['activityId', 'available', 'subjectId', 'title', 'type']); await page.goto(`/materias/${id}`); await expect(page.locator('.activity-card')).toHaveCount(1); await expect(page.locator('.activity-card')).not.toContainText(/Invalid Date|Creada el|\d{1,2}\/\d{1,2}\/\d{4}/);
});

test('recovery: expiry and older versions are handled without restoring or overwriting live work', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"versión":"actual"}'); await enable(page); await save(page); await page.getByRole('button', { name: 'Continuar solo en memoria', exact: true }).click();
  const mutate = async (field: string, value: number) => page.evaluate(async ({ field, value }) => new Promise<void>(resolve => { const request = indexedDB.open('siare-academic-recovery', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('copies', 'readwrite'), read = tx.objectStore('copies').openCursor(); read.onsuccess = () => { const c = read.result; if (c) c.update({ ...c.value, [field]: value }); }; tx.oncomplete = () => { db.close(); resolve(); }; }; }), { field, value });
  await mutate('version', 0); await unlock(page); // Live work requires explicit replacement consent.
  await page.getByLabel('Reemplazar el trabajo actual').check(); await page.getByRole('button', { name: 'Desbloquear y recuperar', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('versión'); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"versión":"actual"}');
  await mutate('expiresAt', Date.now() - 1); await reload(page); await expect(page.getByRole('button', { name: 'Habilitar recuperación local', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Recuperar copia cifrada', exact: true })).toHaveCount(0);
});

test('recovery: session expiry preserves a locked copy for the same authenticated account', async ({ page, baseURL }) => {
  const { id, credentials } = await setup(page, baseURL!); await page.goto(`/materias/${id}`); await tool(page, 'Preparar banco'); await page.getByLabel('Editar banco JSON').fill('{"sesión":"recuperar"}'); await enable(page); await save(page);
  await page.context().clearCookies(); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Catálogo', exact: true }).click(); await page.getByRole('button', { name: 'Actualizar catálogo', exact: true }).click(); await expect(page).toHaveURL(/\/login/);
  expect((await page.request.post('/api/bff/auth/login', { headers: headers(baseURL!), data: { email: credentials.email, password: credentials.password } })).status()).toBe(200); await page.goto(`/materias/${id}`); await unlock(page); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"sesión":"recuperar"}');
});

test('visual A: eight academic states in both themes at all eight requested sizes', async ({ page, baseURL }, info) => {
  test.setTimeout(240_000);
  const output = `${process.env.ACADEMIC_EVIDENCE_DIR ?? "../docs/design/evidencias/h6-3"}/${info.project.name}`; await mkdir(output, { recursive: true });
  const checks: object[] = [], errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const { id, create } = await setup(page, baseURL!); await page.goto(`/materias/${id}`);
  async function captures(state: string, visiblePanel: 'Fuentes' | 'Aprendizaje' = 'Aprendizaje') {
    for (const theme of ['light', 'dark']) {
      await page.locator('summary').filter({ hasText: /^Tema$/ }).click(); await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption(theme); await page.keyboard.press('Escape');
      for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 812]]) {
        await page.setViewportSize({ width, height }); await panel(page, visiblePanel); await page.evaluate(() => document.fonts.ready); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state} ${theme} ${width}`).toBe(true);
        await page.screenshot({ path: `${output}/${state}-${theme}-${width}x${height}.png`, fullPage: true }); checks.push({ state, theme, width, height });
      }
    }
  }
  await captures('vacio');
  const doc = await source(page.request, baseURL!, id, 'fuente-visual.pdf'); await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click(); await page.getByRole('button', { name: 'Usar como fuente fuente-visual.pdf', exact: true }).click(); await captures('documento-seleccionado', 'Fuentes'); await panel(page, 'Aprendizaje'); await captures('lectura');
  const a = await create(); await tool(page, 'Catálogo'); await page.getByRole('button', { name: 'Actualizar catálogo', exact: true }).click(); await open(page, a.activityId); await page.getByRole('radio', { name: 'cuatro', exact: true }).check(); await captures('quiz');
  const c = await create('CROSSWORD'); await tool(page, 'Catálogo'); if ((await page.locator('.catalog-picker').getAttribute('open')) === null) await page.locator('.catalog-picker > summary').click(); await page.getByRole('button', { name: 'Actualizar catálogo', exact: true }).click(); await open(page, c.activityId); await page.locator('.crossword-cell input').first().fill('S'); await captures('crucigrama');
  await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Quitar selección de fuente' }).click(); await tool(page, 'Preparar banco'); await page.getByLabel('Tema exacto del banco').fill('Repaso'); await page.getByLabel('Editar banco JSON').fill(JSON.stringify(bank)); await page.getByRole('button', { name: 'Validar y revisar banco' }).click(); await page.getByLabel('He revisado las preguntas', { exact: false }).check(); await captures('banco-revision');
  await open(page, a.activityId); await page.getByRole('button', { name: 'Enviar respuestas', exact: true }).click(); await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toBeVisible(); await captures('evaluacion');
  // Recovery modal capture uses no phrase and no secrets. Underlying academic state remains real.
  await page.getByRole('button', { name: 'Habilitar recuperación local', exact: true }).click();
  for (const theme of ['light', 'dark']) { await page.evaluate(mode => { document.documentElement.dataset.theme = mode; }, theme); for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 812]]) { await page.setViewportSize({ width, height }); await expect(page.getByRole('dialog')).toBeVisible(); await page.screenshot({ path: `${output}/recuperacion-${theme}-${width}x${height}.png` }); checks.push({ state: 'recuperacion', theme, width, height }); } }
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.setViewportSize({ width: 768, height: 1024 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  expect(errors).toEqual([]); await writeFile(`${output}/validacion.json`, JSON.stringify({ origin: baseURL, browser: page.context().browser()?.version(), documentId: doc.documentId, checks, errors, zoom: 'font scaling 200%; physical mobile keyboard and browser zoom remain manual' }, null, 2));
});


test('documental: scanned READY source displays its OCR warning in the central reader', async ({ page, baseURL }) => {
  const { id } = await setup(page, baseURL!);
  const buffer = await readFile(new URL('../../../.cache/phase2-fixtures/scanned.pdf', import.meta.url));
  await source(page.request, baseURL!, id, 'escaneado-h6.pdf', buffer);
  await page.goto(`/materias/${id}`); await panel(page, 'Fuentes'); await page.getByRole('button', { name: 'Ver texto', exact: true }).click();
  await expect(page.locator('.academic-reading')).toContainText('Se aplicó reconocimiento OCR.');
  await expect(page.locator('.academic-reading iframe, .academic-reading object, .academic-reading embed')).toHaveCount(0);
});

test('documental: uploaded quarantine becomes FAILED safely and offers an explicit retry', async ({ page, baseURL }, info) => {
  const { id } = await setup(page, baseURL!);
  const buffer = await readFile(new URL('../../../.cache/phase2-fixtures/blank.pdf', import.meta.url));
  const response = await page.request.post(`/api/files/subjects/${id}/documents`, { headers: headers(baseURL!), multipart: { file: { name: 'sin-texto-h6.pdf', mimeType: 'application/pdf', buffer } } }); expect(response.status()).toBe(201);
  await page.goto(`/materias/${id}`); await panel(page, 'Fuentes'); const row = page.locator('.document-list > li').filter({ hasText: 'sin-texto-h6.pdf' });
  await expect(row.getByText('Cargado', { exact: true })).toBeVisible(); await expect(row).toContainText('cuarentena'); await expect(row.getByRole('button', { name: /Descargar|Usar como fuente/ })).toHaveCount(0);
  await row.getByRole('button', { name: 'Procesar', exact: true }).click(); await expect(row.getByText('Procesamiento fallido', { exact: true })).toBeVisible({ timeout: 60_000 }); await expect(row.getByRole('button', { name: 'Reintentar procesamiento', exact: true })).toBeEnabled(); await expect(row.getByRole('button', { name: /Descargar|Usar como fuente/ })).toHaveCount(0); await expect(row).toContainText('No se encontró texto reconocible');
  await page.screenshot({ path: `${process.env.ACADEMIC_EVIDENCE_DIR ?? "../docs/design/evidencias/h6-3"}/${info.project.name}/fuente-failed.png`, fullPage: true });
  for (const theme of ['light','dark']) {
    await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
    for (const [width,height] of [[1440,900],[390,844]]) {
      await page.setViewportSize({width,height}); await panel(page,'Fuentes');
      await page.screenshot({path:`${process.env.ACADEMIC_EVIDENCE_DIR ?? "../docs/design/evidencias/h6-3"}/${info.project.name}/fuente-failed-${theme}-${width}x${height}.png`,fullPage:true});
    }
  }

});

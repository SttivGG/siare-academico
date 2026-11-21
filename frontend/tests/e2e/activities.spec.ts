import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

// Full H4 flow against Spring; all content is explicitly synthetic and reviewed for this test.
function pdf() {
  const text = 'SOL LUNA. La respuesta de la suma es cuatro.';
  const stream = `BT /F1 16 Tf 50 750 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n', offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(output); output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
test('document READY → reviewed bank → quiz and crossword → authorized results', async ({ page, context, baseURL }, info) => {
  const headers = { Origin: baseURL!, 'X-SIARE-CSRF': '1' }, email = `h4-${randomUUID()}@example.test`, password = `Synthetic reviewed ${randomUUID()}`;
  expect((await page.request.post('/api/bff/auth/register', { headers, data: { name: 'Estudiante H4', email, password } })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: { email, password } })).status()).toBe(200);
  const response = await page.request.post('/api/bff/subjects', { headers, data: { name: `H4 Astronomía ${info.project.name}` } }); expect(response.status()).toBe(201);
  const subject = (await response.json()).id;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/materias/${subject}`);
  await page.screenshot({ path: `../.cache/h4-empty-${info.project.name}.png`, fullPage: true });
  await expect(page.getByText('Todavía no has consultado evaluaciones aquí.', { exact: false })).toBeVisible();
  await expect(page.getByText('Todavía no hay actividades.', { exact: false })).toBeVisible();
  if (await page.getByRole('navigation', { name: 'Paneles del cuaderno' }).isVisible()) await page.getByRole('button', { name: 'Fuentes', exact: true }).click();
  await page.getByText('Añadir documento', { exact: true }).click();
  await page.getByLabel('Seleccionar documento').setInputFiles({ name: 'astronomia-h4.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: 'Subir documento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'astronomia-h4.pdf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar como fuente', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Procesar', exact: true }).click();
  await expect(page.getByText('Texto disponible', { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Usar como fuente', exact: false }).click();
  const documents = await (await page.request.get(`/api/bff/subjects/${subject}/documents`)).json(), documentId = documents[0].documentId;
  const text = await (await page.request.get(`/api/bff/documents/${documentId}/text`)).json(), fragment = text.fragments.find((f: { text: string }) => f.text.includes('SOL'));
  expect(fragment).toBeTruthy();
  const source = { reference: 'astronomia-h4.pdf · página 1', fragmentIndex: fragment.index, quote: fragment.text.trim() };
  const bank = { validated: true, questions: [{ id: 'q1', prompt: '¿Cuánto es dos más dos?', options: [{ id: 'a', text: 'cuatro' }, { id: 'b', text: 'cinco' }], correctOptionId: 'a', explanation: 'Dos más dos es cuatro.', topic: 'Repaso', source }], words: [{ id: 'w1', answer: 'SOL', clue: 'Estrella del sistema solar.', topic: 'Repaso', source }, { id: 'w2', answer: 'LUNA', clue: 'Satélite de la Tierra.', topic: 'Repaso', source }] };
  for (const type of ['QUIZ', 'CROSSWORD']) {
    if (await page.getByRole('navigation', { name: 'Paneles del cuaderno' }).isVisible()) await page.getByRole('button', { name: 'Aprendizaje', exact: true }).click();
    await page.getByRole('button', { name: 'Preparar banco', exact: true }).click();
    await expect(page.getByText('Fuente READY: astronomia-h4.pdf')).toBeVisible();
    await page.getByLabel('Actividad', { exact: true }).selectOption(type);
    await page.getByLabel('Tema exacto del banco').fill('Repaso');
    await page.getByLabel('Importar ActivityBank (.json)').setInputFiles({ name: 'bank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bank)) });
    await expect(page.getByLabel('Editar banco JSON')).toHaveValue(JSON.stringify(bank));
    await expect(page.getByRole('button', { name: /Crear .* revisado/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Validar y revisar banco' }).click();
    await expect(page.getByRole('region', { name: 'Revisión del banco' })).toBeVisible();
    await page.getByLabel('He revisado las preguntas', { exact: false }).check();
    const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/subjects/${subject}/activities`));
    await page.getByRole('button', { name: /Crear .* revisado/ }).click();
    const creation = await created; expect(creation.status()).toBe(201); const activity = await creation.json();
    expect(JSON.stringify(activity)).not.toMatch(/correctOptionId|"quote"|"expected"/);
    const player = page.locator('.activity-player');
    await expect(player.getByText('Respuesta esperada', { exact: false })).toHaveCount(0);
    if (type === 'QUIZ') {
      await player.getByRole('radio', { name: 'cuatro', exact: true }).check();
      // Lose the first response after Spring commits it: retry must use exactly the same envelope.
      let first = true; const payloads: string[] = [];
      await page.route(`**/api/bff/activities/${activity.activityId}/submissions`, async route => {
        payloads.push(route.request().postData()!);
        const authorized = await route.fetch();
        if (first) { first = false; await route.fulfill({ status: 503, json: { message: 'Interrupción controlada de prueba.' } }); }
        else await route.fulfill({ response: authorized });
      });
      await player.getByRole('button', { name: 'Enviar respuestas' }).click();
      await expect(player.getByRole('radio').first()).toBeDisabled();
      await player.getByRole('button', { name: 'Reintentar envío' }).click();
      await expect(player.getByRole('heading', { name: 'Resultado del intento' })).toBeVisible();
      expect(payloads).toHaveLength(2); expect(payloads[0]).toBe(payloads[1]);
      await page.unroute(`**/api/bff/activities/${activity.activityId}/submissions`);
    } else {
      const solution: Record<string, string> = { w1: 'SOL', w2: 'LUNA' };
      for (const clue of activity.content.clues) for (let i = 0; i < clue.length; i++) {
        const row = clue.row + (clue.direction === 'DOWN' ? i : 0), column = clue.column + (clue.direction === 'ACROSS' ? i : 0);
        await player.getByRole('textbox', { name: new RegExp(`^Fila ${row + 1}, columna ${column + 1}(,|$)`) }).fill(solution[clue.id][i]);
      }
      const firstCell = player.getByRole('textbox').first(); await firstCell.focus(); await firstCell.press('ArrowDown');
      await expect(player.getByRole('textbox', { name: /^Fila 2, columna 1(,|$)/ })).toBeFocused();
      await player.getByRole('button', { name: 'Enviar respuestas' }).click();
    }
    await expect(player.getByRole('region', { name: 'Evaluación de Spring' })).toContainText('100%');
    const attempt = (await player.locator('.identity-id').innerText()).replace('Intento: ', '').trim();
    await page.getByRole('button', { name: 'Intentos', exact: true }).click();
    await page.getByLabel('ID de actividad', { exact: true }).fill(activity.activityId); await page.getByLabel('ID de intento', { exact: true }).fill(attempt);
    await page.getByRole('button', { name: 'Consultar evaluación' }).click();
    await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toContainText(attempt);
  }
  expect((await context.cookies()).find(c => c.name === 'siare_session')?.httpOnly).toBe(true);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.cache/h4-${info.project.name}.png`, fullPage: true });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const scripts = performance.getEntriesByType('resource').filter(e => (e as PerformanceResourceTiming).initiatorType === 'script') as PerformanceResourceTiming[];
    return { domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), scriptBytes: scripts.reduce((total, script) => total + script.encodedBodySize, 0) };
  });
  console.log(`H4 ${info.project.name}: ${JSON.stringify(metrics)}`);
  expect(metrics.scriptBytes).toBeLessThan(1024 * 1024);
  expect(errors).toEqual([]);
});

test('real catalog pagination, large banks, ownership, archival and renewable session', async ({ page, browser, baseURL }) => {
  const headers = { Origin: baseURL!, 'X-SIARE-CSRF': '1' }, email = `h4-catalog-${randomUUID()}@example.test`, password = `Synthetic catalog ${randomUUID()}`;
  expect((await page.request.post('/api/bff/auth/register', { headers, data: { name: 'Catálogo H4', email, password } })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: { email, password } })).status()).toBe(200);
  const subject = (await (await page.request.post('/api/bff/subjects', { headers, data: { name: 'Catálogo paginado H4' } })).json()).id;
  const question = { id: 'q1', prompt: '¿Cuánto es dos más dos?', options: [{ id: 'a', text: 'cuatro' }, { id: 'b', text: 'cinco' }], correctOptionId: 'a', explanation: 'Dos más dos es cuatro.', topic: 'Repaso' };
  const body = { type: 'QUIZ', topic: 'Repaso', count: 1, gridSize: 15, bank: { validated: true, questions: [question], words: [] } };
  let activityId = '';
  for (let i = 0; i < 21; i++) {
    const response = await page.request.post(`/api/bff/subjects/${subject}/activities`, { headers, data: body }); expect(response.status()).toBe(201); activityId = (await response.json()).activityId;
  }
  const large = { ...body, bank: { ...body.bank, questions: Array.from({ length: 12 }, (_, i) => ({ ...question, id: `large${i}`, explanation: 'Texto de revisión sintético. '.repeat(65) })) } };
  expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(16384);
  expect((await page.request.post(`/api/bff/subjects/${subject}/activities`, { headers, data: large })).status()).toBe(201);
  const first = await (await page.request.get(`/api/bff/subjects/${subject}/activities?limit=1`)).json();
  const second = await (await page.request.get(`/api/bff/subjects/${subject}/activities?limit=1&cursor=${first.nextCursor}`)).json();
  expect(first.items).toHaveLength(1); expect(second.items[0].activityId).not.toBe(first.items[0].activityId);
  await page.goto(`/materias/${subject}`);
  await expect(page.locator('.activity-card')).toHaveCount(20); await page.getByRole('button', { name: 'Cargar más actividades' }).click(); await expect(page.locator('.activity-card')).toHaveCount(22);
  // Access expiry renews through HttpOnly cookies, including activity requests.
  await page.context().clearCookies({ name: 'siare_session' });
  await page.getByRole('button', { name: 'Actualizar catálogo' }).click(); await expect(page.locator('.activity-card')).toHaveCount(20);
  const payload = { idempotencyKey: randomUUID(), answers: { q1: 'a' }, durationMs: 1000 };
  expect((await page.request.post(`/api/bff/activities/${activityId}/submissions`, { headers, data: { ...payload, score: 1 } })).status()).toBe(400);
  const evaluationResponse = await page.request.post(`/api/bff/activities/${activityId}/submissions`, { headers, data: payload }); expect(evaluationResponse.status()).toBe(200);
  const evaluation = await evaluationResponse.json();
  const outsider = await browser.newContext({ baseURL });
  try {
    const credentials = { email: `h4-outsider-${randomUUID()}@example.test`, password: `Other synthetic ${randomUUID()}`, name: 'Otra persona' };
    expect((await outsider.request.post('/api/bff/auth/register', { headers, data: credentials })).status()).toBe(201);
    expect((await outsider.request.post('/api/bff/auth/login', { headers, data: { email: credentials.email, password: credentials.password } })).status()).toBe(200);
    expect((await outsider.request.get(`/api/bff/activities/${activityId}/submissions/${evaluation.attemptId}`)).status()).toBe(403);
  } finally { await outsider.close(); }
  expect((await page.request.patch(`/api/bff/subjects/${subject}/archive`, { headers, data: {} })).status()).toBe(200);
  const replay = await page.request.post(`/api/bff/activities/${activityId}/submissions`, { headers, data: payload }); expect(replay.status()).toBe(200); expect(await replay.json()).toEqual(evaluation);
  expect((await page.request.post(`/api/bff/activities/${activityId}/submissions`, { headers, data: { ...payload, idempotencyKey: randomUUID() } })).status()).toBeGreaterThanOrEqual(400);
  await page.reload(); await expect(page.getByRole('button', { name: 'Preparar banco', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Intentos', exact: true }).click(); await page.getByLabel('ID de actividad', { exact: true }).fill(activityId); await page.getByLabel('ID de intento', { exact: true }).fill(evaluation.attemptId); await page.getByRole('button', { name: 'Consultar evaluación' }).click();
  await expect(page.getByRole('region', { name: 'Evaluación de Spring' })).toContainText('100%');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

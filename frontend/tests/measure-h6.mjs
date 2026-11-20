import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Run from frontend: node tests/measure-h6.mjs before|after [origin].
// The private session stays in ignored .cache; published output contains no credentials.
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const origin = process.argv[3] ?? 'http://127.0.0.1:3107';
const out = `../.cache/h6-5/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const headers = { Origin: origin, 'X-SIARE-CSRF': '1' };
  const post = async (path, data, status = 201) => {
    const response = await context.request.post(`/api/bff/${path}`, { headers, data });
    expect(response.status(), path).toBe(status); return response.json();
  };
  let session;
  if (phase === 'before') {
    const credentials = { name: 'Interacciones H6', email: `h65-${randomUUID()}@example.test`, password: `Prueba privada H6 ${randomUUID()}` };
    await post('auth/register', credentials);
    await post('auth/login', { email: credentials.email, password: credentials.password }, 200);
    const subject = await post('subjects', { name: 'Cuaderno de interacciones', description: 'Contenido sintético para comparar H6-4 y H6-5.' });
    const question = { id: 'q1', prompt: '¿Cuánto es dos más dos?', options: [{ id: 'a', text: 'Cuatro' }, { id: 'b', text: 'Cinco' }], correctOptionId: 'a', explanation: 'Suma revisada.', topic: 'Repaso' };
    const bank = { validated: true, questions: [question, { ...question, id: 'q2', prompt: 'Segunda pregunta de repaso' }], words: [{ id: 'w1', answer: 'SOL', clue: 'Estrella del sistema solar.', topic: 'Repaso' }, { id: 'w2', answer: 'LUNA', clue: 'Satélite de la Tierra.', topic: 'Repaso' }] };
    const create = type => post(`subjects/${subject.id}/activities`, { type, topic: 'Repaso', count: 2, gridSize: 15, bank });
    session = { credentials, subject: subject.id, quiz: (await create('QUIZ')).activityId, crossword: (await create('CROSSWORD')).activityId };
    await writeFile('../.cache/h6-5/private-session.json', JSON.stringify(session));
  } else {
    session = JSON.parse(await readFile('../.cache/h6-5/private-session.json', 'utf8'));
    await post('auth/login', { email: session.credentials.email, password: session.credentials.password }, 200);
  }
  await context.addInitScript(() => {
    window.h6Shifts = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.h6Shifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const measurements = [];
  for (const route of ['/login', '/inicio', `/materias/${session.subject}`]) {
    for (let sample = 0; sample < 6; sample++) {
      await page.goto(route, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('main h1').first()).toBeVisible();
      if (route.startsWith('/materias/')) await expect(page.locator('#learning-title')).toBeVisible();
      await page.waitForTimeout(500);
      const metric = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const js = performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname.endsWith('.js'));
        return { dclMs: nav.domContentLoadedEventEnd, loadMs: nav.loadEventEnd, responseMs: nav.responseStart, cls: window.h6Shifts.reduce((a, b) => a + b, 0), jsEncodedBytes: js.reduce((n, r) => n + r.encodedBodySize, 0), jsDecodedBytes: js.reduce((n, r) => n + r.decodedBodySize, 0), jsRequests: js.length, finiteAnimations: document.getAnimations().length };
      });
      measurements.push({ route: route.startsWith('/materias/') ? '/materias/:id' : route, sample, cache: sample ? 'warm' : 'cold-context', ...metric });
    }
  }
  const captures = [];
  async function capture(name) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; localStorage.setItem('siare-theme', value); }, theme);
      await page.evaluate(() => document.fonts.ready);
      // Capture final theme/disclosure states, not a frame partway through 140/220ms.
      await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
      const file = `${name}-${theme}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true, mask: [page.locator('.mfa-enrollment'), page.locator('.recovery-codes'), page.locator('input[type=password]')] });
      captures.push({ name, theme, file });
    }
  }
  for (const [name, route] of [['login', '/login'], ['registro', '/registro'], ['inicio', '/inicio'], ['materias', '/materias'], ['recuperacion', '/recuperar'], ['seguridad', '/seguridad'], ['sesiones', '/sesiones'], ['administracion-user', '/administracion']]) {
    await page.goto(route); await expect(page.locator('main h1').first()).toBeVisible(); await capture(name);
  }
  await page.goto(`/materias/${session.subject}`);
  await expect(page.locator('#learning-title')).toBeVisible(); await capture('cuaderno');
  async function open(id) {
    const picker = page.locator('.catalog-picker');
    if (await picker.getAttribute('open') === null) await picker.locator('summary').click();
    await page.locator(`[data-activity-id="${id}"]`).click();
    await expect(page.locator('.activity-player')).toBeVisible();
  }
  await open(session.quiz); await page.locator('.quiz-options input').first().check(); await capture('quiz-seleccion');
  await open(session.crossword); await page.locator('.clue-button').first().click(); await capture('crucigrama-pista');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('summary[aria-label="Abrir navegación"]').click(); await capture('menu-movil');
  expect(errors).toEqual([]);
  await writeFile(`${out}/measurement.json`, JSON.stringify({ phase, origin, browser: browser.version(), node: process.version, viewport: '1440x900', conditions: 'Chromium headless; production Next Docker 1 CPU/384MiB; system no-preference; 6 sequential hard navigations per route, first excluded from warm median; no CPU/network throttling; 500ms observation after fonts/heading; synthetic USER and same subject both phases. Route bytes include prefetched chunks; no React Profiler in production.', measurements, captures, errors }, null, 2));
  await context.close();
  // Read-only smoke of the habitual frontend.
  const habitual = await browser.newPage(); await habitual.goto('http://127.0.0.1:3100/login'); await expect(habitual.getByLabel('Correo electrónico')).toBeVisible();
  await habitual.screenshot({ path: `${out}/habitual-3100.png`, fullPage: true });
  console.log(`${phase}: ${measurements.length} measurements; ${captures.length} comparative captures; habitual 3100 browser OK`);
} finally { await browser.close(); }

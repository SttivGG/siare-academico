import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { openAccount } from './navigation';

const output = '../docs/design/evidencias/h6-2';
const sizes = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[375,812],[320,812]];
async function createStudent(page: Page, origin: string) {
  const headers = { Origin: origin, 'X-SIARE-CSRF': '1' };
  const credentials = { name: 'Estudiante H6', email: `h6-${randomUUID()}@example.test`, password: `Cuaderno de pruebas ${randomUUID()}` };
  expect((await page.request.post('/api/bff/auth/register', { headers, data: credentials })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: { email: credentials.email, password: credentials.password } })).status()).toBe(200);
  const response = await page.request.post('/api/bff/subjects', { headers, data: { name: 'Programación avanzada', description: 'Fuentes y actividades de verificación H6-2.' } });
  expect(response.status()).toBe(201);
  return { id: (await response.json()).id as string, credentials };
}

test('Nexo global: route captures, both themes, eight viewports and real USER authorization', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'La matriz interna ya incluye móvil y tableta.');
  test.setTimeout(240_000); await mkdir(output, { recursive: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydrat/i.test(message.text())) errors.push(message.text()); });
  const captures: object[] = [], checks: object[] = [];
  const publicRoutes = [['R01','/'],['R02','/login'],['R03','/registro'],['R04','/recuperar'],['R05','/recuperar/confirmar'],['R06','/login/mfa'],['R07','/sesion/renovar'],['X02','/no-existe-h6']];
  await page.goto('/login');
  async function captureRoutes(routes: string[][]) {
    for (const mode of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('siare-theme', value), mode);
      for (const [id, route] of routes) {
        await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        await page.evaluate(() => document.fonts.ready);
        for (const text of ['Consultando actividades…', 'Cargando documentos…', 'Cargando identidades…', 'Actualizando sesiones…']) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
        await expect(page.locator('main')).toHaveCount(1);
        for (const [width,height] of sizes) {
          await page.setViewportSize({ width,height });
          const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, font: getComputedStyle(document.body).fontFamily, scheme: getComputedStyle(document.documentElement).colorScheme }));
          expect(geometry.scrollWidth, `${id} ${mode} ${width}`).toBeLessThanOrEqual(width);
          expect(geometry.font).toContain('Urbanist'); checks.push({ id, theme: mode, height, ...geometry });
          if (width === 1440 || width === 768 || width === 390) {
            const file = `${id}-${mode}-${width}x${height}.png`;
            await page.screenshot({ path: `${output}/${file}`, fullPage: true }); captures.push({ id, route, theme: mode, width, height, file });
          }
        }
      }
    }
  }
  await captureRoutes(publicRoutes);
  const { id } = await createStudent(page, baseURL!);
  await captureRoutes([['R08','/inicio'],['R09','/materias'],['R10','/materias/nueva'],['R11',`/materias/${id}`],['R12','/seguridad'],['R13','/sesiones'],['R14','/administracion']]);
  await expect(page.getByRole('heading', { name: 'Acceso administrativo restringido' })).toBeVisible();
  expect((await page.request.get('/api/bff/admin/users')).status()).toBe(403);
  expect((await page.context().cookies()).filter(cookie => cookie.name.includes('siare_')).every(cookie => cookie.httpOnly)).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['siare-theme']);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  expect(errors).toEqual([]);
  await writeFile(`${output}/validacion.json`, JSON.stringify({ capturedAt: new Date().toISOString(), browser: page.context().browser()?.version(), origin: baseURL, scope: 'production Next H6 isolated with real Spring; synthetic USER; no privileged role changes', captures, checks, errors }, null, 2));
});

test('theme, account and responsive navigation preserve the live form, academic draft', async ({ page, baseURL }, info) => {
  const { id } = await createStudent(page, baseURL!); const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/materias/${id}`);
  await page.getByRole('button', { name: 'Preparar banco', exact: true }).click();
  await page.getByLabel('Tema exacto del banco', { exact: true }).fill('Borrador que conserva su propietario');
  await page.getByLabel('Editar banco JSON').fill('{"borrador":"sin publicar"}');
  await page.locator('summary').filter({ hasText: /^Tema$/ }).click();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('dark');
  await page.keyboard.press('Escape');
  for (const width of [1440,1024,390,320,1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"borrador":"sin publicar"}');
    await expect(page.getByLabel('Tema exacto del banco', { exact: true })).toHaveValue('Borrador que conserva su propietario');
  }
  let archived = 0;
  page.on('request', request => { if (request.method() === 'PATCH' && request.url().endsWith('/archive')) archived++; });
  await page.getByRole('button', { name: 'Archivar materia', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Archivar materia' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  if (info.project.name === 'desktop') await page.screenshot({ path: `${output}/W13-dark-1440x900.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Archivar materia', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Archivar materia', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(archived).toBe(0);
  await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"borrador":"sin publicar"}');
  await page.locator('summary').filter({ hasText: /^Tema$/ }).click();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('light');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Archivar materia', exact: true }).click();
  if (info.project.name === 'desktop') await page.screenshot({ path: `${output}/W13-light-1440x900.png` });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  // H6-2 must not introduce remounts. Switching academic tools remains an H6-3 blocker.
  await page.goto('/materias/nueva');
  await page.getByLabel('Nombre de la materia').fill('Formulario en curso');
  await openAccount(page);
  if (info.project.name === 'desktop') await page.screenshot({ path: `${output}/I01-light-1440x900.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('summary[aria-label="Menú de cuenta"]')).toBeFocused();
  await expect(page.getByLabel('Nombre de la materia')).toHaveValue('Formulario en curso');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('summary[aria-label="Abrir navegación"]').click();
  await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('summary[aria-label="Abrir navegación"]')).toBeFocused();
  expect(errors).toEqual([]);
});

test('system theme without JavaScript, blocked storage and cross-tab synchronization', async ({ browser, baseURL }, info) => {
  const noJs = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark', baseURL });
  try {
    const page = await noJs.newPage(); await page.goto('/login');
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).color)).toBe('rgb(241, 239, 237)');
    await page.screenshot({ path: `${output}/sin-js-dark-${info.project.name}.png` });
  } finally { await noJs.close(); }
  const context = await browser.newContext({ baseURL });
  try {
    const a = await context.newPage(), b = await context.newPage(); await a.goto('/login'); await b.goto('/registro');
    await a.getByRole('combobox', { name: 'Tema' }).selectOption('dark');
    await expect(b.locator('html')).toHaveAttribute('data-theme', 'dark');
    await a.getByRole('combobox', { name: 'Tema' }).selectOption('system');
    await expect(b.locator('html')).not.toHaveAttribute('data-theme');
    await a.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Bloqueado para prueba'); }; });
    await a.getByRole('combobox', { name: 'Tema' }).selectOption('light');
    await expect(a.getByRole('status')).toContainText('no permite guardarlo');
    await expect(a.locator('html')).toHaveAttribute('data-theme', 'light');
  } finally { await context.close(); }
});

test('Nexo semantic contrast, keyboard focus, reduced motion and forced colors', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Mismas propiedades CSS en ambos proyectos.');
  await mkdir(output, { recursive: true }); await page.goto('/login');
  const results: object[] = [];
  for (const theme of ['light','dark']) {
    await page.getByRole('combobox', { name: 'Tema' }).selectOption(theme);
    const measured = await page.evaluate(() => {
      const read = (property: string, token: string) => { const el = document.createElement('span'); el.style.setProperty(property, `var(--${token})`); document.body.append(el); const color = getComputedStyle(el).getPropertyValue(property); el.remove(); return color; };
      const rgb = (color: string) => color.match(/[\d.]+/g)!.map(Number);
      const blend = (front: number[], back: number[]) => front.slice(0,3).map((v,i) => v * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
      const luminance = (color: number[]) => color.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((total,v,i) => total + v * [.2126,.7152,.0722][i],0);
      const pairs: [string,string,number][] = [['on-brand','brand',4.5],['text','surface',4.5],['muted','surface',4.5],['link','surface',4.5],['text','glass',4.5],['muted','glass',4.5],['danger','danger-bg',4.5],['success','success-bg',4.5],['warning','warning-bg',4.5],['info','info-bg',4.5],['focus','input',3],['control','input',3]];
      return pairs.flatMap(([front,back,target]) => ['canvas','wash-a','wash-b'].map(base => {
        const background = blend(rgb(read('background-color',back)),rgb(read('background-color',base)));
        const a = luminance(blend(rgb(read('color',front)),background)), b = luminance(background);
        return { front,back,base,target,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
      }));
    });
    for (const pair of measured) expect(pair.ratio, `${theme} ${pair.front}/${pair.back} over ${pair.base}`).toBeGreaterThanOrEqual(pair.target);
    results.push({ theme, pairs: measured });
  }
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  expect(await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.getByLabel('Correo electrónico').evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: `${output}/X06-forced-colors-reduced-motion.png`, fullPage: true });
  await writeFile(`${output}/contraste.json`, JSON.stringify({ method: 'Actual computed production tokens; sRGB relative luminance; alpha over canvas and gradient extremes. Not a complete pixel-level WCAG audit.', results }, null, 2));
});

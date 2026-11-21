import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence = process.env.LANDING_EVIDENCE_DIR ?? '../docs/design/evidencias/h6-landing';
const providers = [{ provider: 'google', enabled: false }, { provider: 'gitlab', enabled: false }];

test('landing: real provider availability, responsive themes and both tabs', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'La matriz incluye escritorio, tableta y móvil.');
  test.setTimeout(120_000);
  await page.unroute('**/api/bff/auth/oidc/providers');
  await mkdir(evidence, { recursive: true });
  const response = await request.get('/api/bff/auth/oidc/providers');
  expect(response.ok()).toBeTruthy();
  const available: typeof providers = await response.json();
  const errors: string[] = [];
  const geometry = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('siare-theme', value), theme);
    for (const [device, width, height] of [['wide',1920,1080],['large',1728,900],['desktop',1440,900],['landscape',1024,768],['tablet',768,1024],['mobile',390,844],['small',320,812]] as const) {
      await page.setViewportSize({ width, height }); await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('header button')).toHaveCount(1);
      await expect(page.locator('header a, header select')).toHaveCount(0);
      await expect(page.getByText('Reúne tus fuentes.')).toHaveCount(0);
      await expect(page.getByAltText('SIARE')).toBeVisible();
      await expect(page.getByText('Tu espacio de aprendizaje', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Un lugar para empezar.');
      await expect(page.getByText('Organiza tus materias, conecta tus fuentes y encuentra tu propia forma de aprender.')).toBeVisible();
      for (const provider of available) await expect(page.getByRole('button', { name: provider.provider === 'google' ? 'Google' : 'GitLab', exact: true })).toBeEnabled({ enabled: provider.enabled });
      await page.evaluate(() => document.fonts.ready);
      const measure = () => page.evaluate(() => ['main > section', 'main > ol', 'footer', '[role=tabpanel]', '[role=tabpanel] > div', 'main h1', 'main img'].map(selector => {
        const node = document.querySelector(selector)!;
        const rect = (selector === '[role=tabpanel]' ? node.parentElement! : node).getBoundingClientRect();
        return { selector, x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
      }));
      const baseline = await measure();
      for (const register of [false, true]) {
        await page.getByRole('tab', { name: register ? 'Registrarse' : 'Iniciar sesión' }).click();
        await expect(page.getByLabel('Nombre', { exact: true })).toHaveCount(register ? 1 : 0);
        await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('autocomplete', register ? 'new-password' : 'current-password');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        const hero = await page.locator('main > section').boundingBox();
        const cards = await page.locator('main > ol').boundingBox();
        expect(cards!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height - 1);
        await page.evaluate(() => document.fonts.ready);
        const current = await measure();
        for (const [i, box] of current.entries()) for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - baseline[i][key]), `${theme}/${device}/${register}: ${box.selector}.${key}`).toBeLessThan(1);
        geometry.push({ theme, device, register, boxes: current });
        const welcome = page.locator('main h1').locator('..');
        const message = await welcome.boundingBox();
        const panel = await page.getByRole('tabpanel').locator('..').boundingBox();
        expect(panel!.y - (message!.y + message!.height)).toBeGreaterThanOrEqual(24);
        expect(panel!.x).toBeCloseTo(message!.x, 0);
        expect(panel!.width).toBeCloseTo(message!.width, 0);
        const overlay = await page.locator('main').locator('..').evaluate(node => ({
          canvas: getComputedStyle(node).backgroundColor,
          sharedCanvas: getComputedStyle(document.body).backgroundColor,
          grayscale: getComputedStyle(node, '::before').filter,
        }));
        expect(overlay.canvas).toBe(overlay.sharedCanvas);
        expect(overlay.grayscale).toBe('none');
        if (width > 900) {
          const logo = await page.getByAltText('SIARE').boundingBox();
          expect(logo!.x + logo!.width).toBeLessThanOrEqual(message!.x);
          expect(panel!.x).toBeGreaterThan(width / 2);
          expect(panel!.x + panel!.width).toBeGreaterThan(width * .86);
          expect(panel!.x - (logo!.x + logo!.width)).toBeGreaterThanOrEqual(48);
          expect(logo!.width).toBeGreaterThanOrEqual(width > 1200 ? 500 : 300);
        }
        await page.screenshot({ path: `${evidence}/3107-after-${theme}-${device}-${register ? 'register' : 'login'}.png`, fullPage: true });
      }
      for (let repeat = 0; repeat < 3; repeat++) {
        await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
        await page.getByRole('tab', { name: 'Registrarse' }).click();
      }
      expect(await measure()).toEqual(baseline);
    }
  }
  await writeFile(`${evidence}/layout-geometry.json`, JSON.stringify(geometry, null, 2));
  expect(errors).toEqual([]);
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bff/auth/oidc/providers', route => route.fulfill({ json: providers }));
});

test('landing: keyboard tabs, theme persistence, system theme and recovery navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Tema oscuro' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const login = page.getByRole('tab', { name: 'Iniciar sesión' });
  const register = page.getByRole('tab', { name: 'Registrarse' });
  await login.focus(); await page.keyboard.press('ArrowRight');
  await expect(register).toBeFocused(); await expect(register).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home'); await expect(login).toBeFocused();
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
  await expect(page).toHaveURL(/\/recuperar$/);
  await page.goBack(); await expect(login).toHaveAttribute('aria-selected', 'true');
});

test('landing: global theme updates translucent surface, fields and interaction states', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/api/bff/auth/login', route => route.fulfill({ status: 400, json: { message: 'Revisa los datos.', fields: { email: 'Revisa este correo.' } } }));
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('student@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('test password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  const colors = () => page.evaluate(() => {
    const panel = document.querySelector('[role=tabpanel]')!.parentElement!;
    const selectors = ['[role=tablist]', '[role=tab][aria-selected=true]', 'input', 'label', '.hint', '.field-error', '[role=alert]', 'button:disabled'];
    return { surface: getComputedStyle(panel).backgroundColor, blur: getComputedStyle(panel).backdropFilter,
      items: selectors.map(selector => { const css = getComputedStyle(panel.querySelector(selector)!); return { selector, foreground: css.color, background: css.backgroundColor, border: css.borderColor }; }) };
  });
  const dark = await colors();
  const toggle = page.getByRole('button', { name: 'Tema oscuro' });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await colors();
  for (const state of [dark, light]) {
    const rgba = state.surface.match(/[\d.]+/g)!.map(Number);
    expect(rgba[3]).toBeGreaterThan(0); expect(rgba[3]).toBeLessThanOrEqual(0.3);
    expect(Math.max(...rgba.slice(0, 3)) - Math.min(...rgba.slice(0, 3))).toBeLessThanOrEqual(5);
    expect(state.blur).toBe('blur(10px)');
  }
  expect(Number(dark.surface.match(/[\d.]+/)![0])).toBeLessThan(20);
  expect(Number(light.surface.match(/[\d.]+/)![0])).toBeGreaterThan(240);
  for (const [i, item] of light.items.entries()) expect(item, item.selector).not.toEqual(dark.items[i]);
  const input = page.getByLabel('Correo electrónico');
  await input.focus();
  const lightFocus = await input.evaluate(node => getComputedStyle(node).outlineColor);
  await toggle.click(); await input.focus();
  expect(await input.evaluate(node => getComputedStyle(node).outlineColor)).not.toBe(lightFocus);
  await expect(input).toHaveAttribute('aria-describedby', 'email-error');
  await page.reload(); await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.unroute('**/api/bff/auth/oidc/providers');
  await page.route('**/api/bff/auth/oidc/providers', route => route.fulfill({ json: providers.map(provider => ({ ...provider, enabled: true })) }));
  await page.reload();
  const google = page.getByRole('button', { name: 'Google', exact: true });
  await expect(google).toBeEnabled(); await google.hover();
  const darkHover = await google.evaluate(node => getComputedStyle(node).backgroundColor);
  await toggle.click(); await google.hover();
  expect(await google.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(darkHover);
});

test('landing: native validation and field errors reuse the existing login/register transport', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/bff/auth/login', async route => {
    posts++; expect(route.request().headers()['x-siare-csrf']).toBe('1');
    expect(route.request().postDataJSON()).toEqual({ email: 'student@example.test', password: 'test password' });
    await route.fulfill({ status: 400, json: { message: 'Revisa los datos.', fields: { email: 'Revisa este correo.' } } });
  });
  await page.route('**/api/bff/auth/register', route => route.fulfill({ status: 400, json: { message: 'Revisa los datos.', fields: { name: 'Revisa este nombre.', password: 'Elige otra frase.' } } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  expect(posts).toBe(0);
  await page.getByLabel('Correo electrónico').fill('student@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('test password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-describedby', 'email-error');
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  await page.getByRole('tab', { name: 'Registrarse' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Estudiante');
  await page.getByLabel('Correo electrónico').fill('student@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('A long testing passphrase');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  for (const field of ['name', 'password']) {
    await expect(page.locator(`#${field}`)).toHaveAttribute('aria-invalid', 'true');
    expect(await page.locator(`#${field}`).getAttribute('aria-describedby')).toContain(`${field}-error`);
  }
});

test('landing: pending submission cannot be interrupted by switching tabs', async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/bff/auth/login', async route => { await pending; await route.fulfill({ status: 401, json: { message: 'Credenciales inválidas.' } }); });
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('student@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('test password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('tab', { name: 'Registrarse' }).dispatchEvent('click');
  await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'true');
  finish(); await expect(page.locator('form').getByRole('alert')).toContainText('Credenciales inválidas.');
  await page.getByRole('tab', { name: 'Registrarse' }).click(); await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();
});

test('landing: provider buttons retain disabled, error and redirect behavior', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Google', 'GitLab']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name, exact: true }).locator('svg')).toHaveCount(1);
  }
  await page.unroute('**/api/bff/auth/oidc/providers');
  await page.route('**/api/bff/auth/oidc/providers', route => route.fulfill({ json: providers.map(provider => ({ ...provider, enabled: true })) }));
  for (const [provider, name, url] of [['google','Google','https://accounts.google.com/o/oauth2/v2/auth'],['gitlab','GitLab','https://gitlab.com/oauth/authorize']]) {
    await page.route('**/api/oidc/start', route => {
      expect(route.request().postDataJSON()).toEqual({ provider, link: false, confirmed: false });
      return route.fulfill({ status: 503, json: { message: 'Proveedor temporalmente no disponible.', code: 'OIDC_PROVIDER_DISABLED' } });
    });
    await page.goto('/'); await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Proveedor temporalmente no disponible.' })).toBeVisible();
    await page.unroute('**/api/oidc/start');
    await page.route('**/api/oidc/start', route => route.fulfill({ json: { authorizationUrl: url } }));
    await page.route(`${url}**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Provider fixture</title>' }));
    await page.getByRole('button', { name, exact: true }).click(); await expect(page).toHaveURL(url);
    await page.unroute('**/api/oidc/start');
  }
});

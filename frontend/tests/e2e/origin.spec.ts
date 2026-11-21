import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { openAccount, navigateGlobal } from './navigation';

test('internal navigation, expiry, refresh, reload and logout stay on the current origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin, documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByRole('tab', { name: 'Registrarse', exact: true }).click();
  await page.goto('/registro');
  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  await page.goto('/recuperar');
  await page.getByRole('link', { name: 'Volver a iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  await page.goto('/materias');
  await expect(page).toHaveURL(origin + '/login?sesion=expirada');
  const headers = { Origin: origin, 'X-SIARE-CSRF': '1' };
  const credentials = { name: 'Origen controlado', email: `origin-${randomUUID()}@example.test`, password: `Synthetic ${randomUUID()}` };
  expect((await page.request.post('/api/bff/auth/register', { headers, data: credentials })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: credentials })).status()).toBe(200);
  await page.goto('/inicio');
  await navigateGlobal(page, 'Mis materias');
  await expect(page).toHaveURL(origin + '/materias');
  await openAccount(page); await page.getByRole('link', { name: 'Apariencia', exact: true }).click();
  await expect(page).toHaveURL(origin + '/configuracion/apariencia');
  await openAccount(page); await page.getByRole('link', { name: 'Cuenta y seguridad', exact: true }).click();
  await expect(page).toHaveURL(origin + '/seguridad');
  await page.reload(); await expect(page).toHaveURL(origin + '/seguridad');
  const oldRefresh = (await page.context().cookies()).find(c => c.name === 'siare_refresh')!.value;
  await page.context().clearCookies({ name: 'siare_session' });
  await page.goto('/inicio'); await expect(page.getByRole('heading', { name: 'Hola, Origen controlado.' })).toBeVisible();
  expect((await page.context().cookies()).find(c => c.name === 'siare_refresh')!.value).not.toBe(oldRefresh);
  await openAccount(page); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  await page.goto('/inicio?next=http://127.0.0.1:3100/login');
  await expect(page).toHaveURL(origin + '/login?sesion=expirada');
  expect(documents.every(url => new URL(url).origin === origin)).toBe(true);
});

test('callbacks ignore return parameters and never redirect across frontend ports', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  for (const value of ['http://127.0.0.1:3100/login','http://127.0.0.1:3107/login','https://evil.example','//evil.example','/\\evil.example']) {
    const params = new URLSearchParams({ next: value, returnTo: value, callbackUrl: value });
    const response = await page.request.get(`/api/oidc/callback/google?${params}`, { maxRedirects: 0, headers: { 'X-Forwarded-Host': 'evil.example' } });
    expect(response.status()).toBe(303);
    expect(response.headers().location.startsWith('/login?')).toBe(true);
    expect(new URL(response.headers().location, origin).origin).toBe(origin);
  }
});

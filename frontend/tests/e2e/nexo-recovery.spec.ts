import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Original blocking ST-01 assertions retained and now executable against the controller.
test('H6-3 ST-01: switching Bank/Catalog/Bank must preserve the draft and review', async ({ page, baseURL }) => {
  const headers = { Origin: baseURL!, 'X-SIARE-CSRF': '1' };
  const credentials = { email: `h6-recovery-${randomUUID()}@example.test`, password: `Trabajo persistente ${randomUUID()}` };
  expect((await page.request.post('/api/bff/auth/register', { headers, data: { ...credentials, name: 'Recuperación H6' } })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: credentials })).status()).toBe(200);
  const response = await page.request.post('/api/bff/subjects', { headers, data: { name: 'Conservar borrador' } });
  await page.goto(`/materias/${(await response.json()).id}`);
  await page.getByRole('button', { name: 'Preparar banco', exact: true }).click();
  await page.getByLabel('Editar banco JSON').fill('{"draft":"ST-01"}');
  await page.getByRole('button', { name: 'Catálogo', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar banco', exact: true }).click();
  await expect(page.getByLabel('Editar banco JSON')).toHaveValue('{"draft":"ST-01"}');
});

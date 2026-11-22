import { type Page } from '@playwright/test';
export async function openAccount(page: Page) {
  const trigger = page.locator('summary[aria-label="Menú de cuenta"]');
  if (!(await trigger.isVisible())) await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  if (!(await trigger.locator('..').getAttribute('open') === '')) await trigger.click();
}
export async function navigateGlobal(page: Page, name: string) {
  const link = page.getByRole('link', { name, exact: true });
  if (!(await link.isVisible())) await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await link.click();
}
export async function chooseTheme(page: Page, theme: string) {
  const select = page.getByRole('combobox', { name: 'Tema', exact: true });
  if (await select.count()) await select.selectOption(theme);
  else {
    const toggle = page.getByRole('button', { name: 'Tema oscuro', exact: true });
    if ((await toggle.getAttribute('aria-pressed') === 'true') !== (theme === 'dark')) await toggle.click();
  }
}

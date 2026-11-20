import { type Page } from '@playwright/test';
export async function openAccount(page: Page) {
  const trigger = page.locator('summary[aria-label="Menú de cuenta"]');
  if (!(await trigger.locator('..').getAttribute('open') === '')) await trigger.click();
}
export async function navigateGlobal(page: Page, name: string) {
  const link = page.getByRole('link', { name, exact: true });
  if (!(await link.isVisible())) await page.locator('summary[aria-label="Abrir navegación"]').click();
  await link.click();
}

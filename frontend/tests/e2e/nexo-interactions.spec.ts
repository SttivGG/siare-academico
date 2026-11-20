import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const sizes = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[375,812],[320,812]];
async function setup(page: Page, origin: string) {
  const headers = { Origin: origin, 'X-SIARE-CSRF': '1' };
  const credentials = { name: 'Interacciones H6-5', email: `h65-e2e-${randomUUID()}@example.test`, password: `Interacciones propias ${randomUUID()}` };
  expect((await page.request.post('/api/bff/auth/register', { headers, data: credentials })).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login', { headers, data: { email: credentials.email, password: credentials.password } })).status()).toBe(200);
  const subject = await (await page.request.post('/api/bff/subjects', { headers, data: { name: 'Cuaderno H6-5' } })).json();
  return { id: subject.id as string, headers };
}
async function learning(page: Page) {
  if (await page.getByRole('navigation', { name: 'Paneles del cuaderno' }).isVisible()) await page.getByRole('button', { name: 'Aprendizaje', exact: true }).click();
}

test('H6-5: disclosures close on focus departure, Escape, outside pointer and breakpoint; retain form', async ({ page, baseURL }) => {
  await setup(page, baseURL!); await page.goto('/materias/nueva');
  const field = page.getByLabel('Nombre de la materia'); await field.fill('Borrador intacto');
  const account = page.locator('summary[aria-label="Menú de cuenta"]');
  const theme = page.locator('summary').filter({ hasText: /^Tema$/ });
  for (const selectedTheme of ['light', 'dark']) {
    await theme.click(); await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption(selectedTheme); await page.keyboard.press('Escape');
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width,height });
      await account.focus(); await page.keyboard.press('Enter');
      await expect(account.locator('..')).toHaveAttribute('open', '');
      await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Cuenta y seguridad', exact: true })).toBeFocused();
      await page.keyboard.press('Escape'); await expect(account).toBeFocused();
      await account.click(); await field.focus(); await expect(account.locator('..')).not.toHaveAttribute('open');
      await account.click(); await theme.click(); await expect(account.locator('..')).not.toHaveAttribute('open');
      await expect(theme.locator('..')).toHaveAttribute('open', '');
      await page.keyboard.press('Escape'); await expect(theme).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width <= 700) {
        const mobile = page.locator('summary[aria-label="Abrir navegación"]');
        await mobile.click(); await page.keyboard.press('Tab');
        const link = page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('link').first(); await expect(link).toBeFocused();
        await page.setViewportSize({ width: 1440,height:900 });
        await expect(mobile.locator('..')).not.toHaveAttribute('open'); await expect(account).toBeFocused();
      }
      await expect(field).toHaveValue('Borrador intacto');
    }
  }
  // Tab exits rather than leaving a disclosure over the form.
  await account.click(); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(account.locator('..')).not.toHaveAttribute('open');
  await account.click(); await page.getByRole('heading', { name: 'Crear materia' }).click(); await expect(account.locator('..')).not.toHaveAttribute('open');
});

test('H6-5: quiz focus/progress, crossword current clue and reduced-motion/forced-colors in eight sizes', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const { id, headers } = await setup(page, baseURL!);
  const question = { id:'q1', prompt:'Pregunta de teclado', options:[{id:'a',text:'Primera opción'},{id:'b',text:'Segunda opción'}],correctOptionId:'a',explanation:'Evaluación del servidor.',topic:'Repaso' };
  const bank = { validated:true,questions:[question,{...question,id:'q2',prompt:'Segunda pregunta'}],words:[{id:'w1',answer:'SOL',clue:'Estrella del sistema solar.',topic:'Repaso'},{id:'w2',answer:'LUNA',clue:'Satélite de la Tierra.',topic:'Repaso'}] };
  async function create(type: string) {
    const response = await page.request.post(`/api/bff/subjects/${id}/activities`,{headers,data:{type,topic:'Repaso',count:2,gridSize:15,bank}}); expect(response.status()).toBe(201); return (await response.json()).activityId;
  }
  const quiz = await create('QUIZ'), crossword = await create('CROSSWORD');
  await page.goto(`/materias/${id}`); await learning(page);
  async function open(activity: string) {
    const picker = page.locator('.catalog-picker'); if (await picker.getAttribute('open') === null) await picker.locator('summary').click();
    await page.locator(`[data-activity-id="${activity}"]`).click(); await expect(page.locator('.activity-player > h3')).toBeFocused();
  }
  await open(quiz); await page.getByRole('radio', { name:'Primera opción' }).focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('progressbar', { name:'Preguntas respondidas' })).toHaveAttribute('value','1');
  const firstPrompt = await page.locator('.activity-player h4').textContent();
  await page.getByRole('button',{name:'Siguiente',exact:true}).click(); await expect(page.locator('.activity-player h4')).toBeFocused();
  await expect(page.locator('.activity-player h4')).not.toHaveText(firstPrompt!);
  await page.getByRole('button',{name:'Anterior',exact:true}).click(); await expect(page.getByRole('radio',{name:'Primera opción'})).toBeChecked();
  await open(crossword); const clue = page.locator('.clue-button').first(); await clue.click();
  await expect(clue).toHaveAttribute('aria-current','true');
  const firstCell = page.locator('input:focus'); await expect(firstCell).toHaveAttribute('aria-describedby',new RegExp((await clue.getAttribute('id'))!.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.keyboard.type('S');
  for (const theme of ['light','dark']) {
    await page.evaluate(value => {document.documentElement.dataset.theme=value;},theme);
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height}); await learning(page);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await clue.click(); const focused = page.locator('input:focus');
      const rect = await focused.boundingBox(); expect(rect!.y + rect!.height).toBeLessThan(height - (width<=700 ? 62 : 0));
      await expect(page.locator('.crossword-cell[data-active-word=true]').first()).toBeVisible();
    }
  }
  await page.emulateMedia({ reducedMotion:'reduce',forcedColors:'active' }); await clue.click();
  expect(await clue.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await open(quiz); await expect(page.getByRole('radio',{name:'Primera opción'})).toBeChecked();
  let submissions=0; let release!:()=>void;
  const gate = new Promise<void>(resolve=>{release=resolve;});
  await page.route(`**/api/bff/activities/${quiz}/submissions`,async route=>{submissions++;await gate;await route.continue();});
  const send = page.getByRole('button',{name:'Enviar respuestas',exact:true}); await send.click();
  await expect(page.getByRole('button',{name:'Obteniendo evaluación…'})).toBeDisabled(); expect(submissions).toBe(1);
  release(); await expect(page.getByRole('status').filter({hasText:'aciertos'})).toBeVisible();
});

test('H6-5: lookup errors identify the field, focus it and retain both values',async({page,baseURL})=>{
  const {id}=await setup(page,baseURL!); await page.goto(`/materias/${id}`); await learning(page);
  await page.getByRole('button',{name:'Intentos',exact:true}).click();
  const activity=page.getByLabel('ID de actividad'),attempt=page.getByLabel('ID de intento');
  await activity.fill('actividad-incompleta');await attempt.fill('intento-incompleto');
  await page.getByRole('button',{name:'Consultar evaluación',exact:true}).click();
  await expect(activity).toBeFocused();await expect(activity).toHaveAttribute('aria-invalid','true');await expect(attempt).toHaveAttribute('aria-invalid','true');
  await expect(activity).toHaveValue('actividad-incompleta');await expect(attempt).toHaveValue('intento-incompleto');
  await expect(page.locator('#lookup-activity-error')).toBeVisible();await expect(page.locator('#lookup-attempt-error')).toBeVisible();
});

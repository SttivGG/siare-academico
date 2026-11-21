import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const origin = 'http://127.0.0.1:3107';
const session = JSON.parse(await readFile('../.cache/h6-5/private-session.json', 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 900 } });
  expect((await context.request.post('/api/bff/auth/login', { headers: { Origin: origin, 'X-SIARE-CSRF': '1' }, data: { email: session.credentials.email, password: session.credentials.password } })).status()).toBe(200);
  const page = await context.newPage(); const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  const results = [];
  for (const route of ['/inicio', `/materias/${session.subject}`]) {
    await page.goto(route); await page.evaluate(() => document.fonts.ready);
    if (route.startsWith('/materias/')) {
      await expect(page.locator('#learning-title')).toBeVisible();
      const picker = page.locator('.catalog-picker'); if (await picker.getAttribute('open') === null) await picker.locator('summary').click();
      await page.locator(`[data-activity-id="${session.crossword}"]`).click(); await expect(page.locator('.crossword')).toBeVisible();
    }
    await page.waitForTimeout(750);
    await page.evaluate(() => { window.h6Mutations = 0; window.h6Observer = new MutationObserver(records => { window.h6Mutations += records.length; }); window.h6Observer.observe(document.querySelector('main'), { subtree:true, childList:true, attributes:true, characterData:true }); });
    const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name,m.value]));
    await page.waitForTimeout(2000);
    const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name,m.value]));
    const dom = await page.evaluate(() => { window.h6Observer.disconnect(); return { mutations:window.h6Mutations, runningAnimations:document.getAnimations().filter(a=>a.playState==='running').length }; });
    results.push({ route:route.startsWith('/materias/')?'/materias/:id crossword':route, idleMs:2000, ...dom, delta:Object.fromEntries(['LayoutCount','RecalcStyleCount','ScriptDuration','TaskDuration','JSHeapUsedSize'].map(k=>[k,after[k]-before[k]])) });
  }
  await writeFile(`../.cache/h6-5/${phase}/idle.json`, JSON.stringify({ phase, browser:browser.version(), method:'CDP Performance metrics and MutationObserver after 750ms settling; 2s idle. These are DOM/layout/task observations, not React commit counts or a CPU benchmark.',results },null,2));
  console.log(`${phase}: idle DOM/layout/task measurements saved`);
} finally { await browser.close(); }

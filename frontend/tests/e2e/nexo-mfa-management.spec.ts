import { test, expect } from '@playwright/test';
import { randomUUID, createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
function totp(seed: string) {
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let buffer=0,bits=0;const bytes:number[]=[];
 for(const c of seed){buffer=(buffer<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();const offset=h[19]&15;return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
test('H6-4: real USER MFA regeneration and disable retain reauthentication and safe cancellation',async({page,baseURL},info)=>{
 async function captureSafe(state: string) {
  if (info.project.name !== 'desktop') return;
  await mkdir('../.cache/h6-4-real',{recursive:true});
  for (const theme of ['light','dark']) {
   await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
   for (const [width,height] of [[1440,900],[390,844]]) { await page.setViewportSize({width,height}); await page.screenshot({path:`../.cache/h6-4-real/${state}-${theme}-${width}x${height}.png`,fullPage:true,mask:[page.locator('.mfa-enrollment canvas'),page.locator('#manual-seed'),page.locator('.recovery-codes'),page.locator('input[type=password]')],maskColor:'#555555'}); }
  }
  await page.setViewportSize({width:1440,height:900});
 }
 const headers={Origin:baseURL!,'X-SIARE-CSRF':'1'},credentials={name:'MFA H6-4',email:`h64-mfa-${randomUUID()}@example.test`,password:`Frase MFA sintética ${randomUUID()}`};
 expect((await page.request.post('/api/bff/auth/register',{headers,data:credentials})).status()).toBe(201);expect((await page.request.post('/api/bff/auth/login',{headers,data:{email:credentials.email,password:credentials.password}})).status()).toBe(200);
 await page.goto('/seguridad');await page.getByLabel('Contraseña actual',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Configurar aplicación autenticadora'}).click();await expect(page.getByLabel('Clave de configuración (solo se muestra ahora)')).toBeVisible();
 await captureSafe('I02-enrolamiento-oculto');
 const seed=await page.getByLabel('Clave de configuración (solo se muestra ahora)').inputValue();await page.getByLabel('Código de tu nueva aplicación').fill(totp(seed));await page.getByRole('button',{name:'Confirmar y activar MFA'}).click();await expect(page.getByRole('heading',{name:'Guarda tus códigos de recuperación'})).toBeVisible();await captureSafe('I02-codigos-iniciales-ocultos');const oldCodes=await page.locator('.recovery-codes code').allTextContents();await page.getByRole('link',{name:'Ya guardé los códigos · continuar'}).click();await expect(page).toHaveURL(/\/inicio/);
 await page.goto('/seguridad');await expect(page.locator('#manage-password')).toBeVisible();await page.locator('#manage-password').fill(credentials.password);await page.locator('#manage-code').fill(oldCodes[0]);let mutations=0;page.on('request',req=>{if(req.method()==='POST'&&/\/mfa\/(disable|recovery-codes)$/.test(req.url()))mutations++;});
 for(const name of ['Regenerar códigos de recuperación','Desactivar MFA y cerrar sesiones']){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();}expect(mutations).toBe(0);await expect(page.locator('#manage-password')).toHaveValue(credentials.password);
 await page.getByRole('button',{name:'Regenerar códigos de recuperación',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar regeneración'}).click();await expect(page.getByRole('heading',{name:'Guarda tus códigos de recuperación'})).toBeVisible();expect(mutations).toBe(1);const newCodes=await page.locator('.recovery-codes code').allTextContents();expect(newCodes).toHaveLength(10);expect(newCodes).not.toEqual(oldCodes);
 if(info.project.name==='desktop'){await mkdir('../.cache/h6-4-real',{recursive:true});for(const theme of ['light','dark']){await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.screenshot({path:`../.cache/h6-4-real/I02-codigos-ocultos-${theme}-1440x900.png`,fullPage:true,mask:[page.locator('.recovery-codes')],maskColor:'#555555'});}}
 expect((await page.context().cookies()).some(c=>c.name==='siare_session'||c.name==='siare_refresh')).toBe(false);
 await page.getByRole('link',{name:'Ya guardé los códigos · continuar'}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(credentials.email);await page.getByLabel('Contraseña',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page).toHaveURL(/\/login\/mfa/);await captureSafe('A04-desafio-real');await page.getByRole('button',{name:'Usar un código de recuperación'}).click();await page.getByLabel('Código de recuperación',{exact:true}).fill(newCodes[0]);await page.getByRole('button',{name:'Verificar segundo factor'}).click();await expect(page).toHaveURL(/\/inicio/);
 await page.goto('/seguridad');await page.locator('#manage-password').fill(credentials.password);await page.locator('#manage-code').fill(newCodes[1]);await page.getByRole('button',{name:'Desactivar MFA y cerrar sesiones'}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar desactivación'}).click();await expect(page).toHaveURL(/\/login$/);expect(mutations).toBe(2);
 expect((await page.request.post('/api/bff/auth/login',{headers,data:{email:credentials.email,password:credentials.password}})).status()).toBe(200);expect((await (await page.request.get('/api/bff/users/me/mfa')).json()).state).toBe('DISABLED');
});

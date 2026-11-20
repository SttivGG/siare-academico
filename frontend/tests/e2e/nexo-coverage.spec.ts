import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
const out='../.cache/h6-4-real';
async function capture(page: import('@playwright/test').Page, state: string, desktop: boolean) {
  if (!desktop) return;
  await mkdir(out,{recursive:true});
  for(const theme of ['light','dark']) {
    await page.evaluate(value=>{localStorage.setItem('siare-theme',value);document.documentElement.dataset.theme=value;},theme);
    for(const [width,height] of [[1440,900],[390,844]]) {
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.locator('input[type=password]').evaluateAll(inputs=>inputs.forEach(input=>(input as HTMLInputElement).toggleAttribute('data-capture-secret',!!(input as HTMLInputElement).value)));
      await page.screenshot({path:`${out}/${state}-${theme}-${width}x${height}.png`,fullPage:true,mask:[page.locator('[data-capture-secret]'),page.locator('.mfa-enrollment canvas'),page.locator('#manual-seed'),page.locator('.recovery-codes')],maskColor:'#555555'});
    }
  }
  await page.setViewportSize({width:1440,height:900});
}
test('H6-4: real session revocation, every cancel avoids mutation; revoke-all clears academic copies',async({page,browser,baseURL},info)=>{
  const headers={Origin:baseURL!,'X-SIARE-CSRF':'1'};
  const credentials={name:'Sesiones H6-4',email:`h64-${randomUUID()}@example.test`,password:`Frase sintética H6 cuatro ${randomUUID()}`};
  expect((await page.request.post('/api/bff/auth/register',{headers,data:credentials})).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login',{headers,data:credentials})).status()).toBe(200);
  const current=(await (await page.request.get('/api/bff/users/me/sessions')).json())[0].id;
  const second=await browser.newContext({baseURL});
  try {
    expect((await second.request.post('/api/bff/auth/login',{headers,data:credentials})).status()).toBe(200);
    const sessions=await (await page.request.get('/api/bff/users/me/sessions')).json(); const target=sessions.find((s:{id:string})=>s.id!==current).id;
    const subject=await (await page.request.post('/api/bff/subjects',{headers,data:{name:'Continuidad académica H6-4'}})).json();
    await page.goto(`/materias/${subject.id}`); await page.getByRole('button',{name:'Preparar banco',exact:true}).click(); await page.getByLabel('Editar banco JSON').fill('{"borrador":"conservar en cancelación"}');
    await page.getByRole('button',{name:'Habilitar recuperación local',exact:true}).click(); await page.getByLabel('Frase local de recuperación').fill('Frase local sintética para H6 cuatro'); await page.getByLabel('Autorizo una copia local cifrada').check(); await page.getByRole('button',{name:'Habilitar copia cifrada',exact:true}).click(); await expect(page.getByRole('button',{name:'Guardar copia ahora'})).toBeVisible(); await page.getByRole('button',{name:'Guardar copia ahora'}).click(); await expect(page.locator('.academic-recovery > p')).toContainText('Copia cifrada guardada');
    page.once('dialog',dialog=>dialog.accept()); await page.goto('/sesiones');
    await expect(page.getByRole('button',{name:'Cerrar esta sesión',exact:true})).toHaveCount(2);
    let mutations=0; page.on('request',req=>{if(req.url().includes('/users/me/sessions/')&&req.method()!=='GET')mutations++;});
    for(const name of ['Cerrar otras sesiones','Cerrar todas las sesiones']) {
      await page.getByRole('button',{name,exact:true}).click(); await expect(page.getByRole('dialog').getByRole('button',{name:'Cancelar'})).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.getByRole('button',{name,exact:true})).toBeFocused();
      await page.getByRole('button',{name,exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();
    }
    const row=page.locator(`[data-session-id="${target}"]`); await row.getByRole('button',{name:'Cerrar esta sesión',exact:true}).click(); await capture(page,'I05-confirmar-sesion',info.project.name==='desktop'); await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click(); expect(mutations).toBe(0);
    await row.getByRole('button',{name:'Cerrar esta sesión',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirmar cierre'}).click(); await expect(page.getByRole('button',{name:'Cerrar esta sesión',exact:true})).toHaveCount(1); expect(mutations).toBe(1); expect((await second.request.get('/api/bff/users/me')).status()).toBe(401);
    await capture(page,'I05-revocada',info.project.name==='desktop');
    await page.getByRole('button',{name:'Cerrar todas las sesiones',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirmar cierre'}).click(); await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get('/api/bff/users/me')).status()).toBe(401);
    const count=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const req=indexedDB.open('siare-academic-recovery');req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('copies')){db.close();reject(new Error('Missing recovery store'));return;}const tx=db.transaction('copies','readonly');const get=tx.objectStore('copies').count();get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};req.onerror=()=>reject(req.error);})); expect(count).toBe(0);
  } finally {await second.close();}
});
test('H6-4: real subject search, empty filters, field errors and public notices',async({page,baseURL},info)=>{
  const headers={Origin:baseURL!,'X-SIARE-CSRF':'1'}; const credentials={name:'Materias H6-4',email:`h64-search-${randomUUID()}@example.test`,password:`Frase sintética materias ${randomUUID()}`};
  expect((await page.request.post('/api/bff/auth/register',{headers,data:credentials})).status()).toBe(201); expect((await page.request.post('/api/bff/auth/login',{headers,data:credentials})).status()).toBe(200);
  await page.goto('/materias'); await expect(page.getByRole('heading',{name:'Un espacio para cada materia'})).toBeVisible(); await capture(page,'R09-vacio',info.project.name==='desktop');
  await page.getByRole('link',{name:'Crear mi primera materia'}).click(); await page.getByLabel('Nombre de la materia').fill('Programación Nexo'); await page.getByLabel('Descripción (opcional)').fill('Búsqueda sobre los datos existentes.'); await page.getByRole('button',{name:'Crear materia',exact:true}).click(); await expect(page).toHaveURL(/\/materias\/[a-f0-9-]+$/);
  await page.goto('/materias'); await page.getByLabel('Buscar materias').fill('dato inexistente'); await expect(page.getByRole('heading',{name:'No encontramos materias'})).toBeVisible(); await capture(page,'R09-sin-coincidencias',info.project.name==='desktop');
  await page.getByRole('button',{name:'Limpiar búsqueda'}).click(); await expect(page.getByRole('heading',{name:'Programación Nexo'})).toBeVisible(); await page.getByLabel('Mostrar',{exact:true}).selectOption('archived'); await expect(page.getByRole('heading',{name:'No hay materias archivadas'})).toBeVisible(); await capture(page,'R09-archivadas-vacio',info.project.name==='desktop');
  await page.context().clearCookies(); await page.goto('/login?registro=1'); await capture(page,'A02-registro-listo',info.project.name==='desktop'); await page.goto('/login?sesion=expirada'); await capture(page,'A02-sesion-expirada',info.project.name==='desktop');
  await page.getByLabel('Correo electrónico',{exact:true}).fill(credentials.email); await page.getByLabel('Contraseña',{exact:true}).fill('Una frase incorrecta de prueba'); await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click(); await expect(page.locator('.notice.error')).toBeVisible(); await expect(page.getByLabel('Correo electrónico',{exact:true})).toHaveValue(credentials.email); await capture(page,'A01-error-real',info.project.name==='desktop');
});

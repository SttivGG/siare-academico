import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Production Next + isolated loopback upstream. These fixtures NEVER authorize real roles.
const out = fileURLToPath(new URL('../../../.cache/h6-4-controlled/', import.meta.url));
const actor = '00000000-0000-4000-8000-000000000001', student = '00000000-0000-4000-8000-000000000002';
const scope = '00000000-0000-4000-8000-000000000003', other = '00000000-0000-4000-8000-000000000004';
const date = '2026-11-20T15:00:00Z';
let app, upstream, browser, origin, page, context, role = 'ADMIN', mode = '', version = 2, registration = true;
let mutations = [], captures = [], geometry = [], consoleErrors = [];
const sizes = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[375,812],[320,812]];
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
before(async () => {
  await mkdir(out, { recursive: true });
  upstream = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const path = req.url.replace('/api/v1/', ''), body = JSON.parse(raw || '{}');
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') mutations.push({ path, method: req.method, ...(path.startsWith('admin/') ? { body } : {}) });
    const access = { userId: actor, role, scopeId: scope, enabled: true, version: 0 };
    if (path === 'users/me') return reply(200, { id: actor, name: 'Identidad controlada H6-4', email: 'fixture@example.test' });
    if (path === 'users/me/identity') return reply(200, access);
    if (path === 'admin/overview') return mode === 'overview-error' ? reply(503, {}) : role === 'USER' ? reply(403, { message: 'Acceso denegado.' }) : reply(200, { identity: access });
    if (path === 'admin/users' && mode === 'admin-loading') await delay(3000);
    if (path === 'admin/users' && req.method === 'GET') return mode === 'admin-error' ? reply(403, { message: 'El acceso administrativo requiere una sesión MFA vigente.' }) : reply(200, mode === 'empty' ? [] : [access, { userId: student, role: 'USER', scopeId: scope, enabled: true, version }]);
    if (path === 'admin/scopes' && req.method === 'GET') return reply(200, [{ id: scope, name: 'Ámbito de prueba' }, ...(role === 'SUPERADMIN' ? [{ id: other, name: 'Otro ámbito de prueba' }] : [])]);
    if (path === 'admin/audit') return mode === 'audit-error' ? reply(503, { message: 'No se pudo consultar la auditoría.' }) : reply(200, mode === 'empty' ? [] : [{ id: 'event-fixture', operation: 'ROLE_SCOPE_CHANGE', occurredAt: date, outcome: 'SUCCESS', resource: 'Cuenta sintética de prueba' }]);
    if (path === 'admin/scopes') return reply(201, { id: other, name: body.name });
    if (path === 'admin/parameters/public-registration') {
      if (req.method === 'PATCH') { if (mode === 'conflict') return reply(409, { message: 'El parámetro cambió. Recarga la página.' }); registration = body.enabled; }
      return reply(200, { enabled: registration, version });
    }
    if (path === `admin/users/${student}/access`) {
      if (mode === 'conflict') return reply(409, { message: 'La asignación cambió. Recarga la página.' });
      version++; return reply(200, { ...body, userId: student, version });
    }
    if (path === 'auth/register') return reply(403, { message: 'El registro público está temporalmente cerrado.' });
    if (path === 'auth/login') return reply(400, { message: 'Revisa los datos de acceso.', fields: { email: 'Correo no válido.' } });
    if (path === 'auth/password-reset/request') return reply(202, { message: 'Si la cuenta está disponible, recibirás instrucciones.' });
    if (path === 'auth/password-reset/complete') return reply(400, { message: 'El enlace es inválido, ha caducado o ya fue utilizado.' });
    if (path === 'auth/mfa/verify' || path === 'auth/mfa/recover') return reply(401, { message: 'El desafío ha caducado. Inicia sesión de nuevo.' });
    if (path === 'auth/oidc/providers') return reply(200, [{ provider: 'google', enabled: true }, { provider: 'gitlab', enabled: false }]);
    if (path === 'users/me/mfa') return reply(200, { state: 'ENABLED', pendingReplacement: false, recoveryCodesRemaining: 8, required: false, localPassword: true });
    if (path.startsWith('users/me/mfa/')) return reply(400, { message: 'El código no es válido. Intenta con un código nuevo.' });
    if (path === 'users/me/identities') return reply(200, [{ id: student, provider: 'google', linkedAt: date }]);
    if (path.startsWith('users/me/identities/')) return reply(409, { message: 'Debes conservar al menos una vía de acceso.' });
    if (path === 'users/me/sessions') {
      if (mode === 'loading') await delay(1500);
      return mode === 'session-error' ? reply(503, { message: 'No se pudieron consultar las sesiones.' }) : reply(200, mode === 'empty' ? [] : [{ id: student, createdAt: date, lastSeenAt: date, absoluteExpiresAt: date }]);
    }
    if (path === 'subjects') return reply(200, []);
    return reply(404, { message: 'Fixture sin ruta.' });
  });
  const upstreamPort = await listen(upstream), reservation = createServer(), port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve)); origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: ['ignore','ignore','ignore'], env: { ...process.env, APP_ORIGIN: origin, CORE_API_URL: `http://127.0.0.1:${upstreamPort}`, SESSION_COOKIE_SECURE: 'false', NEXT_TELEMETRY_DISABLED: '1' } });
  let ready = false; for (let i=0;i<100;i++) { try { await fetch(origin+'/login'); ready=true; break; } catch {} await delay(200); } assert.ok(ready);
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
});
after(async () => {
  await context?.close(); await browser?.close(); app?.kill(); await new Promise(resolve => upstream?.close(resolve));
  await writeFile(out+'/validation.json', JSON.stringify({ kind: 'controlled HTTP upstream; real production Next and Chromium; no real privileged identity or external OIDC verified', browser: browser?.version(), captures, geometry, consoleErrors }, null, 2));
  assert.deepEqual(consoleErrors, []);
});
async function open(path, selectedRole = 'ADMIN', selectedMode = '') {
  await context?.close(); role = selectedRole; mode = selectedMode; mutations = [];
  context = await browser.newContext({ baseURL: origin, viewport: { width:1440,height:900 }, reducedMotion:'reduce' });
  await context.addCookies([{ name:'siare_session', value:'controlled-fixture', url: origin, httpOnly:true, sameSite:'Strict' }]);
  page = await context.newPage(); page.on('pageerror', e => consoleErrors.push(e.message)); await page.goto(path);
}
async function capture(ids, state) {
  for (const theme of ['light','dark']) {
    await page.evaluate(value => { localStorage.setItem('siare-theme', value); document.documentElement.dataset.theme=value; }, theme);
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width,height }); await page.evaluate(() => document.fonts.ready);
      const actual = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, width:innerWidth }));
      assert.ok(actual.scroll <= width, `${state} ${theme} ${width}: ${actual.scroll}`); geometry.push({ids,state,theme,width,height,...actual});
      if (width === 1440 || width === 390) {
        const file = `${state}-${theme}-${width}x${height}.png`;
        await page.locator('input[type=password]').evaluateAll(inputs => inputs.forEach(input => input.toggleAttribute('data-capture-secret', !!input.value)));
        await page.screenshot({ path:out+'/'+file, fullPage:true, mask:[page.locator('[data-capture-secret]'),page.locator('.mfa-enrollment canvas'),page.locator('#manual-seed'),page.locator('.recovery-codes')], maskColor:'#555555' }); captures.push({ids,state,theme,width,height,file});
      }
    }
  }
  await page.setViewportSize({width:1440,height:900});
}

test('ADMIN: scoped controls, protected own access, cancel/Escape without mutation and one versioned confirmation', async () => {
  await open('/administracion'); await expect(page.getByRole('heading',{name:'Usuarios del ámbito'})).toBeVisible();
  assert.equal(await page.getByRole('combobox',{name:'Rol',exact:true}).count(),0);
  await expect(page.getByRole('heading',{name:'Auditoría reciente'})).toHaveCount(0);
  const form = page.getByRole('form',{name:`Asignación de ${student}`});
  await form.getByLabel('Cuenta habilitada').uncheck(); await capture(['R14','D02','X06'],'admin-ambito');
  await form.getByRole('button',{name:'Guardar asignación'}).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button',{name:'Cancelar'})).toBeFocused();
  for(let i=0;i<8;i++){await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(el=>document.activeElement===document.body || el.contains(document.activeElement)));}
  await capture(['D02','X05'],'admin-confirmacion'); await page.keyboard.press('Escape'); assert.equal(mutations.length,0);
  await expect(form.getByRole('button',{name:'Guardar asignación'})).toBeFocused();
  await form.getByRole('button',{name:'Guardar asignación'}).click(); await dialog.getByRole('button',{name:'Cancelar'}).click(); assert.equal(mutations.length,0);
  await form.getByRole('button',{name:'Guardar asignación'}).click(); await dialog.getByRole('button',{name:'Confirmar actualización'}).click();
  await expect(page.getByRole('status').filter({hasText:'Asignación actualizada'})).toBeVisible();
  assert.deepEqual(mutations,[{path:`admin/users/${student}/access`,method:'PATCH',body:{role:'USER',scopeId:scope,enabled:false,version:2}}]);
});
test('SUPERADMIN: scopes, registration, audit, explicit confirmations and concurrent version conflicts', async () => {
  await open('/administracion','SUPERADMIN'); await expect(page.getByRole('heading',{name:'Auditoría reciente'})).toBeVisible();
  await capture(['R14','D03','D04','D05'],'superadmin');
  const form = page.getByRole('form',{name:`Asignación de ${student}`}); await form.getByLabel('Rol',{exact:true}).selectOption('ADMIN'); await form.getByLabel('Ámbito',{exact:true}).selectOption(other);
  await form.getByRole('button',{name:'Guardar asignación'}).click(); mode='conflict';
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar actualización'}).click();
  await expect(page.locator('.notice.error')).toContainText('Conservamos los valores'); await expect(form.getByLabel('Rol',{exact:true})).toHaveValue('ADMIN'); await capture(['D03','X06'],'conflicto-version');
  assert.equal(mutations.length,1); assert.equal(mutations[0].body.version,version);
  mode=''; version++; await page.getByRole('button',{name:'Consultar versión actual'}).click(); await expect(page.locator('.notice.error')).toHaveCount(0);
  await page.getByRole('button',{name:'Cerrar registro público'}).click(); await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click(); assert.equal(mutations.length,1);
  await page.getByRole('button',{name:'Cerrar registro público'}).click(); mode='conflict'; await page.getByRole('dialog').getByRole('button',{name:'Confirmar actualización'}).click(); await expect(page.locator('.notice.error')).toContainText('El parámetro cambió'); await capture(['D04'],'registro-conflicto');
  mode=''; await page.getByRole('button',{name:'Consultar versión actual'}).click(); await expect(page.locator('.notice.error')).toHaveCount(0);
  await page.getByRole('button',{name:'Cerrar registro público'}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirmar actualización'}).click(); await expect(page.getByRole('button',{name:'Abrir registro público'})).toBeVisible();
  await page.getByLabel('Nombre del nuevo ámbito').fill('Ámbito creado en fixture'); await page.getByRole('button',{name:'Crear ámbito',exact:true}).click(); await expect(page.getByRole('status').filter({hasText:'Ámbito creado.'})).toBeVisible();
  await open('/administracion','SUPERADMIN','empty'); await expect(page.getByRole('heading',{name:'Sin eventos en esta consulta'})).toBeVisible(); await capture(['D03','D05'],'administracion-vacia');
  await open('/administracion','ADMIN','admin-error'); await expect(page.locator('.notice.error')).toContainText('MFA vigente'); await capture(['D01','D02'],'administracion-error');
  await open('/administracion','SUPERADMIN','audit-error'); await expect(page.locator('.notice.error')).toContainText('auditoría'); await capture(['D05'],'auditoria-error');
  await open('/administracion','USER'); await expect(page.getByRole('heading',{name:'Acceso administrativo restringido'})).toBeVisible(); await capture(['D01'],'administracion-denegada');
});
test('access and recovery: field errors, retained values, registration closed, invalid token and expired MFA', async () => {
  await open('/'); await capture(['R01'],'portada-servicio-no-disponible');
  await open('/login/mfa?configurar=1'); await capture(['R06','A04'],'mfa-configuracion-requerida');
  await open('/login'); await page.getByLabel('Correo electrónico',{exact:true}).fill('fixture@example.test'); await page.getByLabel('Contraseña',{exact:true}).fill('Contraseña de fixture sin identidad real'); await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await expect(page.getByLabel('Correo electrónico',{exact:true})).toHaveAttribute('aria-invalid','true'); await expect(page.getByLabel('Correo electrónico',{exact:true})).toHaveValue('fixture@example.test'); await capture(['A01','X06'],'login-error-campo');
  await open('/registro'); await page.getByLabel('Nombre',{exact:true}).fill('Fixture'); await page.getByLabel('Correo electrónico',{exact:true}).fill('fixture@example.test'); await page.getByLabel('Contraseña',{exact:true}).fill('Contraseña de fixture sin identidad real'); await page.getByRole('button',{name:'Crear cuenta',exact:true}).click(); await expect(page.locator('.notice.error')).toContainText('temporalmente cerrado'); await capture(['R03'],'registro-cerrado');
  await open('/recuperar/confirmar#token=invalid-synthetic-token'); await page.getByLabel('Nueva contraseña',{exact:true}).fill('Frase nueva de fixture sin cuenta real'); await page.getByLabel('Confirma la nueva contraseña').fill('Frase diferente de fixture sin cuenta real'); await page.getByRole('button',{name:'Guardar nueva contraseña'}).click(); await expect(page.getByLabel('Confirma la nueva contraseña')).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Confirma la nueva contraseña').fill('Frase nueva de fixture sin cuenta real'); await page.getByRole('button',{name:'Guardar nueva contraseña'}).click(); await expect(page.locator('.notice.error')).toContainText('ha caducado'); assert.equal(new URL(page.url()).hash,''); await capture(['R05','A05'],'recuperacion-invalida');
  await open('/login/mfa'); await page.getByLabel('Código de tu aplicación autenticadora').fill('000000'); await page.getByRole('button',{name:'Verificar segundo factor'}).click(); await expect(page.locator('.notice.error')).toContainText(/venció|caducado/); await capture(['R06','A04'],'mfa-expirada');
  await page.getByRole('button',{name:'Usar un código de recuperación'}).click(); await capture(['A04'],'mfa-recuperacion');
});
test('security: account identity, unlink safe cancellation, MFA sensitive-action cancellation and failure', async () => {
  await open('/seguridad'); await expect(page.getByText('Estado MFA:',{exact:false})).toBeVisible(); await capture(['R12','I01','I02','I04'],'seguridad-activa');
  await page.getByRole('button',{name:'Desconectar Google'}).click(); await capture(['I04','X05'],'desconectar-identidad'); await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click(); assert.equal(mutations.length,0);
  await page.getByRole('button',{name:'Desconectar Google'}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirmar desconexión'}).click(); await expect(page.locator('.notice.error')).toContainText('al menos una vía'); await capture(['I04'],'identidad-protegida');
  await page.locator('#manage-password').fill('Contraseña de fixture'); await page.locator('#manage-code').fill('000000'); const before=mutations.length;
  await page.getByRole('button',{name:'Desactivar MFA y cerrar sesiones'}).click(); await capture(['I03','X05'],'mfa-desactivar-confirmacion'); await page.keyboard.press('Escape'); assert.equal(mutations.length,before);
  await page.getByRole('button',{name:'Regenerar códigos de recuperación',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click(); assert.equal(mutations.length,before);
  await page.getByRole('button',{name:'Regenerar códigos de recuperación',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirmar regeneración'}).click(); await expect(page.locator('.notice.error').filter({hasText:'código no es válido'})).toBeVisible(); await capture(['I03'],'mfa-error-reautenticacion');
});
test('sessions: loading, errors and empty states; failure boundary renders and retry returns to authorized page', async () => {
  await open('/sesiones','USER','loading'); await expect(page.getByRole('status').filter({hasText:'Actualizando sesiones'})).toBeVisible();
  for (const theme of ['light','dark']) { await page.evaluate(value=>document.documentElement.dataset.theme=value,theme); const file=`sesiones-carga-${theme}-1440x900.png`; await page.screenshot({path:out+'/'+file,fullPage:true}); captures.push({ids:['X03'],state:'sesiones-carga',theme,width:1440,height:900,file}); }
  await expect(page.getByRole('button',{name:'Cerrar esta sesión',exact:true})).toBeEnabled(); await capture(['R13','I05'],'sesiones-lista');
  await open('/sesiones','USER','session-error'); await expect(page.locator('.notice.error')).toContainText('No se pudieron consultar'); await capture(['I05'],'sesiones-error');
  await open('/sesiones','USER','empty'); await expect(page.getByRole('heading',{name:'No hay sesiones activas'})).toBeVisible(); await capture(['I05'],'sesiones-vacias');
  await open('/administracion','ADMIN','admin-loading'); await expect(page.getByRole('status').filter({hasText:'Cargando administración'})).toBeVisible();
  for (const theme of ['light','dark']) { await page.evaluate(value=>document.documentElement.dataset.theme=value,theme); const file=`administracion-carga-${theme}-1440x900.png`; await page.screenshot({path:out+'/'+file,fullPage:true}); captures.push({ids:['X03'],state:'administracion-carga',theme,width:1440,height:900,file}); }
  await open('/administracion','ADMIN','overview-error'); await expect(page.getByRole('heading',{name:'No pudimos cargar este espacio'})).toBeVisible(); await capture(['X01'],'error-inesperado');
  mode=''; await page.getByRole('button',{name:'Volver a intentar'}).click(); await expect(page.getByRole('heading',{name:'Administración',exact:true})).toBeVisible();
});

import { openAccount, navigateGlobal } from "./navigation";
import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

function totp(seed: string) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let buffer=0,bits=0; const bytes: number[]=[];
  for(const c of seed) { buffer=(buffer<<5)|alphabet.indexOf(c); bits+=5; if(bits>=8) { bits-=8; bytes.push((buffer>>>bits)&255); } }
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=createHmac("sha1",Buffer.from(bytes)).update(counter).digest(); const offset=h[19]&15;
  return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");
}

test("enrolls using local QR, keeps challenge HttpOnly, recovers once and preserves USER boundaries", async ({page,baseURL}) => {
  const headers={Origin:baseURL!,"X-SIARE-CSRF":"1"};
  const credentials={email:`mfa-browser-${randomUUID()}@example.test`,password:`Mis apuntes seguros ${randomUUID()}`};
  expect((await page.request.post("/api/bff/auth/register",{headers,data:{...credentials,name:"Seguridad MFA"}})).status()).toBe(201);
  expect((await page.request.post("/api/bff/auth/login",{headers,data:credentials})).status()).toBe(200);
  await page.goto("/seguridad");
  await expect(page.getByRole("status")).toContainText("sin configurar");
  await page.getByLabel("Contraseña actual",{exact:true}).fill(credentials.password);
  await page.getByRole("button",{name:"Configurar aplicación autenticadora"}).click();
  await expect(page.getByRole("img",{name:"QR para agregar SIARE a tu aplicación autenticadora"})).toBeVisible();
  const seed=await page.getByLabel("Clave de configuración (solo se muestra ahora)").inputValue();
  await page.getByLabel("Código de tu nueva aplicación").fill(totp(seed));
  await page.getByRole("button",{name:"Confirmar y activar MFA"}).click();
  await expect(page.getByRole("heading",{name:"Guarda tus códigos de recuperación"})).toBeVisible();
  const codes=await page.locator(".recovery-codes code").allTextContents(); expect(codes).toHaveLength(10);
  await page.getByRole("link",{name:"Ya guardé los códigos · continuar"}).click();
  await expect(page).toHaveURL(/\/inicio/);
  await openAccount(page);
  await page.getByRole("button",{name:"Cerrar sesión",exact:true}).click();
  await page.getByLabel("Correo electrónico",{exact:true}).fill(credentials.email);
  await page.getByLabel("Contraseña",{exact:true}).fill(credentials.password);
  await page.getByRole("button",{name:"Iniciar sesión",exact:true}).click();
  await expect(page).toHaveURL(/\/login\/mfa/);
  const cookie=(await page.context().cookies()).find(c=>c.name==="siare_mfa");
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe("Strict");
  expect((await page.context().cookies()).some(c=>c.name==="siare_session" || c.name==="siare_refresh")).toBe(false);
  expect((await page.request.get("/api/bff/admin/users")).status()).toBe(401);
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  await page.getByRole("button",{name:"Usar un código de recuperación"}).click();
  await page.getByLabel("Código de recuperación",{exact:true}).fill(codes[0]);
  await page.getByRole("button",{name:"Verificar segundo factor"}).click();
  await expect(page).toHaveURL(/\/inicio/);
  expect((await page.request.get("/api/bff/admin/users")).status()).toBe(403);
  expect((await page.request.post("/api/bff/users/me/mfa/disable",{data:{password:credentials.password,code:codes[1]}})).status()).toBe(403);
  await page.goto("/seguridad");
  await expect(page.getByRole("status")).toContainText("Códigos disponibles: 9");
  expect(await page.locator("body").evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`../.cache/h2b1-security-${test.info().project.name}.png`,fullPage:true});
  await openAccount(page);
  await page.getByRole("button",{name:"Cerrar sesión",exact:true}).click();
  await page.getByLabel("Correo electrónico",{exact:true}).fill(credentials.email);
  await page.getByLabel("Contraseña",{exact:true}).fill(credentials.password);
  await page.getByRole("button",{name:"Iniciar sesión",exact:true}).click();
  await expect(page).toHaveURL(/\/login\/mfa/);
  await page.getByRole("button",{name:"Usar un código de recuperación"}).click();
  await page.getByLabel("Código de recuperación",{exact:true}).fill(codes[0]);
  await page.getByRole("button",{name:"Verificar segundo factor"}).click();
  await expect(page.getByRole("alert").filter({hasText:"ya fue utilizado"})).toBeVisible();
  expect((await page.request.get("/api/bff/users/me")).status()).toBe(401);
});

test("password recovery shows uniform response, CSRF protection and missing-link feedback",async ({page,baseURL})=>{
  await page.goto("/recuperar");
  await page.getByLabel("Correo electrónico").fill(`missing-${randomUUID()}@example.test`);
  await page.getByRole("button",{name:"Solicitar recuperación",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Si la cuenta está disponible");
  expect((await page.request.post("/api/bff/auth/password-reset/request",{data:{email:"missing@example.test"}})).status()).toBe(403);
  const response=await page.request.post("/api/bff/auth/password-reset/request",{headers:{Origin:baseURL!,"X-SIARE-CSRF":"1"},data:{email:`missing-${randomUUID()}@example.test`}});
  expect(response.status()).toBe(202); expect((await response.json()).token).toBeUndefined();
  await page.goto("/recuperar/confirmar");
  await expect(page.getByRole("button",{name:"Guardar nueva contraseña"})).toBeDisabled();
  await expect(page.getByText("Abre el enlace completo del correo.",{exact:false})).toBeVisible();
});

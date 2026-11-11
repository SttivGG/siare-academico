import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {compose} from './compose-command.mjs';
const core='http://127.0.0.1:8180/api/v1/';
const frontend='http://127.0.0.1:3100';
const bff=frontend+'/api/bff/';
const headers={Origin:frontend,'X-SIARE-CSRF':'1','Sec-Fetch-Site':'same-origin'};
let checks=0;
async function call(path,method='GET',body,token,expected=200,base=core,extra={}) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Connection:'close',...extra,...(token?{Authorization:`Bearer ${token}`}:{})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'manual'});
  if(expected!==null) assert.equal(response.status,expected,`${method} ${path}: unexpected HTTP status`);
  checks++; return response;
}
async function json(...args) {return (await call(...args)).json();}
function cookies(response) {return response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
const email=`h2a-${randomUUID()}@example.test`,password=`Una frase sintética ${randomUUID()} con Unicode é`;
const user=await json('auth/register','POST',{name:'Prueba H2A',email,password},null,201);
await call('auth/register','POST',{name:'Intrusión',email:`bad-${email}`,password,role:'SUPERADMIN'},null,400);
for(const weak of ['corta','1234567890123456','passwordpassword'])
  await call('auth/register','POST',{name:'Débil',email:`weak-${randomUUID()}@example.test`,password:weak},null,400);
const first=await json('auth/login','POST',{email,password});
assert.equal(first.tokenType,'Bearer'); assert.equal(first.refreshToken.length,43);
const claims=JSON.parse(Buffer.from(first.accessToken.split('.')[1],'base64url'));
assert.ok(claims.sid); assert.ok(claims.jti); assert.ok(claims.exp-claims.iat<=900);
assert.equal((await json('users/me/identity','GET',undefined,first.accessToken)).role,'USER');
for(const path of ['admin/overview','admin/users','admin/scopes','admin/audit']) await call(path,'GET',undefined,first.accessToken,403);
const rotated=await json('auth/refresh','POST',{refreshToken:first.refreshToken});
assert.notEqual(rotated.refreshToken,first.refreshToken);
await call('auth/refresh','POST',{refreshToken:first.refreshToken},null,401);
await call('users/me','GET',undefined,rotated.accessToken,401);
await call('auth/refresh','POST',{refreshToken:rotated.refreshToken},null,401);
const second=await json('auth/login','POST',{email,password});
const third=await json('auth/login','POST',{email,password});
await call(`users/me/sessions/${third.sessionId}`,'DELETE',{},second.accessToken);
await call('users/me','GET',undefined,third.accessToken,401);
const race=await Promise.all([0,1].map(()=>call('auth/refresh','POST',{refreshToken:second.refreshToken},null,null)
  .catch(e=>{throw e;})));
// Call races separately without assuming which request wins.
assert.deepEqual(race.map(r=>r.status).sort(),[200,401]);
await call('users/me','GET',undefined,second.accessToken,401);

const browserLogin=await call('auth/login','POST',{email,password},null,200,bff,headers);
const publicBody=await browserLogin.clone().json();
assert.equal(publicBody.accessToken,undefined); assert.equal(publicBody.refreshToken,undefined);
const setCookies=browserLogin.headers.getSetCookie();
assert.equal(setCookies.length,2); assert.ok(setCookies.every(c=>/HttpOnly/i.test(c)));
assert.ok(setCookies.some(c=>c.startsWith('siare_refresh=')&&/SameSite=strict/i.test(c)));
let cookie=cookies(browserLogin);
await call('auth/refresh','POST',{},null,403,bff,{Cookie:cookie});
const renewed=await call('auth/refresh','POST',{refreshToken:'browser input is ignored'},null,200,bff,{...headers,Cookie:cookie});
cookie=cookies(renewed);
await call('users/me/sessions','GET',undefined,null,200,bff,{Cookie:cookie});
const sessions=await json('users/me/sessions','GET',undefined,null,200,bff,{Cookie:cookie});
assert.ok(sessions.length>=1);
await call('administracion','GET',undefined,null,200,frontend+'/',{Cookie:cookie});
const browserToken=cookie.split('; ').find(c=>c.startsWith('siare_session=')).slice('siare_session='.length);
if(process.argv.includes('--restart')) {
  compose('restart'); compose('up','--detach','--wait','--wait-timeout','900');
  await call('users/me','GET',undefined,browserToken);
  await call('users/me','GET',undefined,second.accessToken,401);
  await call('users/me/sessions','GET',undefined,null,200,bff,{Cookie:cookie});
}
await call('auth/logout','POST',{},null,200,bff,{...headers,Cookie:cookie});
await call('users/me','GET',undefined,browserToken,401);
await call('auth/refresh','POST',{},null,401,bff,{...headers,Cookie:cookie});
// Verify a real account/document fixture that predates H2-A; old tokens must be rejected.
const oldFixture=new URL('../.local/h1-continuity.json',import.meta.url);
if(existsSync(oldFixture)) {
  const old=JSON.parse(readFileSync(oldFixture,'utf8'));
  await call('users/me','GET',undefined,old.token,401);
  const previous=await json('auth/login','POST',old.credentials);
  assert.equal((await json('users/me','GET',undefined,previous.accessToken)).id,old.userId);
  await call(`subjects/${old.subjectId}`,'GET',undefined,previous.accessToken);
  await call(`documents/${old.documentId}/download`,'GET',undefined,previous.accessToken);
  await call(`documents/${old.documentId}/text`,'GET',undefined,previous.accessToken);
} else console.log('SKIP continuidad de instalación H1: no existe su fixture privado. La migración aislada se prueba con IdentityMigrationTests.');
for(let i=0;i<5;i++) await call('auth/login','POST',{email:`abuse-${email}`,password:'incorrecta'},null,401);
await call('auth/login','POST',{email:`abuse-${email}`,password:'incorrecta'},null,429);
console.log(`OK H2-A: ${checks} verificaciones HTTP, rotación/reutilización, BFF/CSRF, permisos, logout, continuidad y límite de intentos.`);

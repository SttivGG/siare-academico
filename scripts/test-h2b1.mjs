import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { compose } from './compose-command.mjs';

const base='http://127.0.0.1:8180/api/v1/';
let checks=0;
async function call(path,method='GET',body,token,expected=200) {
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Connection:'close',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  // Do not dump payloads: enrollment and recovery responses contain one-time secrets.
  assert.equal(r.status,expected,`${method} ${path}: unexpected status`); checks++; return r.json();
}
function totp(seed,step=Math.floor(Date.now()/30000)) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let buffer=0,bits=0; const bytes=[];
  for(const c of seed) { buffer=(buffer<<5)|alphabet.indexOf(c); bits+=5; if(bits>=8) { bits-=8; bytes.push((buffer>>>bits)&255); } }
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(); const offset=h[19]&15;
  return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
async function account() {
  const credentials={email:`h2b1-${randomUUID()}@example.test`,password:`Mis factores protegen ${randomUUID()}`};
  const user=await call('auth/register','POST',{...credentials,name:'Validación H2B1'},null,201);
  const auth=await call('auth/login','POST',credentials); return {credentials,user,auth};
}
async function enrolled() {
  const a=await account(); const e=await call('users/me/mfa/enroll','POST',{password:a.credentials.password},a.auth.accessToken);
  assert.equal((await call('users/me/mfa','GET',undefined,a.auth.accessToken)).state,'PENDING');
  const seed=new URL(e.otpauthUri).searchParams.get('secret');
  const activationCode=totp(seed);
  const result=await call('users/me/mfa/confirm','POST',{code:activationCode},a.auth.accessToken);
  assert.equal(result.recoveryCodes.length,10);
  await call('users/me','GET',undefined,a.auth.accessToken,401);
  assert.equal((await call('users/me/mfa','GET',undefined,result.session.accessToken)).state,'ENABLED');
  return {...a,seed,activationCode,result};
}
const a=await enrolled();
const challenge=await call('auth/login','POST',a.credentials);
assert.equal(challenge.mfaRequired,true); assert.equal(challenge.enrollmentRequired,false);
assert.equal(challenge.accessToken,null); assert.equal(challenge.refreshToken,null);
await call('admin/users','GET',undefined,challenge.challengeToken,401);
await call('auth/mfa/verify','POST',{challengeToken:challenge.challengeToken,code:'wrong'},null,401);
await call('auth/mfa/verify','POST',{challengeToken:challenge.challengeToken,code:a.activationCode},null,401); // activation step is consumed
const recovered=await call('auth/mfa/recover','POST',{challengeToken:challenge.challengeToken,code:a.result.recoveryCodes[0]});
await call('users/me','GET',undefined,a.result.session.accessToken,401);
await call('admin/users','GET',undefined,recovered.accessToken,403); // MFA does not elevate USER
let current=await call('auth/refresh','POST',{refreshToken:recovered.refreshToken});
assert.equal(current.sessionId,recovered.sessionId);
if(process.argv.includes('--restart')) {
  compose('restart','mysql','core-api','frontend');
  compose('up','--detach','--wait','--wait-timeout','900');
  await call('users/me','GET',undefined,current.accessToken);
  assert.equal((await call('users/me/mfa','GET',undefined,current.accessToken)).state,'ENABLED');
  current=await call('auth/refresh','POST',{refreshToken:current.refreshToken});
  await call('users/me','GET',undefined,a.auth.accessToken,401);
}
const b=await enrolled();
const c=await call('auth/login','POST',b.credentials);
const recovery=await call('auth/mfa/recover','POST',{challengeToken:c.challengeToken,code:b.result.recoveryCodes[0]});
const next=await call('auth/login','POST',b.credentials);
await call('auth/mfa/recover','POST',{challengeToken:next.challengeToken,code:b.result.recoveryCodes[0]},null,401);
const regenerated=await call('users/me/mfa/recovery-codes','POST',{password:b.credentials.password,code:b.result.recoveryCodes[1]},recovery.accessToken);
assert.equal(regenerated.recoveryCodes.length,10); assert.ok(regenerated.recoveryCodes.every(code=>!b.result.recoveryCodes.includes(code)));
await call('users/me','GET',undefined,recovery.accessToken,401);
const missing=await call('auth/password-reset/request','POST',{email:`missing-${randomUUID()}@example.test`},null,202);
const present=await call('auth/password-reset/request','POST',{email:a.credentials.email},null,202);
assert.deepEqual(present,missing); assert.equal(present.token,undefined);
console.log(JSON.stringify({checks,mfaPersistence:process.argv.includes('--restart'),smtpDelivery:'PENDING: no SMTP credentials; token lifecycle verified in isolated captured-mail tests'}));

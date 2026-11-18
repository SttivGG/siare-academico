import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const statePath = new URL('../.local/h1-continuity.json', import.meta.url);
const base = 'http://127.0.0.1:8180/api/v1/';
async function call(path, method='GET', body, token, status=200) {
  const response = await fetch(base+path, {method, signal:AbortSignal.timeout(30000),
    headers:{...(body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(token ? {Authorization:`Bearer ${token}`} : {})},
    body:body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)});
  assert.equal(response.status,status,`${method} ${path}`); return response;
}
if (process.argv.includes('--prepare')) {
  const credentials={email:`h1-${randomUUID()}@example.test`,password:`Synthetic-${randomUUID()}`};
  const user=await (await call('auth/register','POST',{...credentials,name:'Continuidad H1'},undefined,201)).json();
  const token=(await (await call('auth/login','POST',credentials)).json()).accessToken;
  const subject=await (await call('subjects','POST',{name:'Persistencia entre Compose'},token,201)).json();
  const bytes=readFileSync(new URL('../.cache/phase2-fixtures/academic.pdf',import.meta.url));
  const form=new FormData(); form.append('file',new Blob([bytes],{type:'application/pdf'}),'continuity.pdf');
  const document=await (await call(`subjects/${subject.id}/documents`,'POST',form,token,201)).json();
  await call(`documents/${document.documentId}/process`,'POST',{},token,202);
  let ready=false;
  for(let i=0;i<90;i++) { const m=await (await call(`documents/${document.documentId}`,'GET',undefined,token)).json(); if(m.status==='READY'){ready=true;break;} assert.notEqual(m.status,'FAILED'); await new Promise(r=>setTimeout(r,1000)); }
  assert.ok(ready);
  mkdirSync(new URL('../.local/',import.meta.url),{recursive:true});
  writeFileSync(statePath,JSON.stringify({credentials,userId:user.id,token,subjectId:subject.id,documentId:document.documentId,sha256:createHash('sha256').update(bytes).digest('hex')}),{mode:0o600});
  console.log('OK continuity fixture prepared before migration; credentials kept in ignored .local.');
} else {
  const s=JSON.parse(readFileSync(statePath,'utf8'));
  assert.equal((await (await call('users/me','GET',undefined,s.token)).json()).id,s.userId);
  assert.equal((await (await call(`subjects/${s.subjectId}`,'GET',undefined,s.token)).json()).name,'Persistencia entre Compose');
  const bytes=Buffer.from(await (await call(`documents/${s.documentId}/download`,'GET',undefined,s.token)).arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
  assert.match((await (await call(`documents/${s.documentId}/text`,'GET',undefined,s.token)).json()).text,/ciencias/);
  const login=await (await call('auth/login','POST',s.credentials)).json(); assert.ok(login.accessToken);
  console.log('OK pre-migration user, subject, original GridFS SHA-256, extracted text, RSA token and login preserved.');
}

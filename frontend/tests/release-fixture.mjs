// Test-only HTTP contract model. All users, files and sessions live in memory.
// This exercises the production frontend/BFF; it does not validate Spring security or extraction.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.RELEASE_TEST_PORT || 3137);
if (![3137, 3138].includes(port)) throw new Error('Fixture may only bind its reserved test ports');
const users = new Map(), sessions = new Map(), refreshes = new Map(), challenges = new Map();
const subjects = new Map(), documents = new Map(), activities = new Map(), attempts = new Map();
const opaque = () => randomBytes(32).toString('base64url');
const now = () => new Date().toISOString();
const crossword = JSON.parse(await readFile(new URL('./fixtures/h3/crossword.json', import.meta.url), 'utf8')).content;
function issue(user, existing) {
  const accessToken = opaque(), refreshToken = opaque();
  const session = existing || { id: randomUUID(), user, createdAt: now() };
  session.accessToken = accessToken; session.refreshToken = refreshToken; sessions.set(accessToken, session); refreshes.set(refreshToken, session);
  return { accessToken, refreshToken, expiresAt: new Date(Date.now()+3600000).toISOString(), refreshExpiresAt: new Date(Date.now()+7200000).toISOString() };
}
function revoke(s) { if (!s) return; for (const [k,v] of sessions) if(v===s) sessions.delete(k); for(const [k,v] of refreshes) if(v===s) refreshes.delete(k); }
function revokeUser(user, except) { for(const s of new Set(sessions.values())) if(s.user===user && s!==except) revoke(s); }
const upstream = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://fixture.invalid'), path = url.pathname.replace(/^\/api\/v1\//, ''), parts = path.split('/');
    const chunks=[]; for await(const chunk of req) chunks.push(chunk); const raw=Buffer.concat(chunks);
    const body = req.headers['content-type']?.startsWith('application/json') ? JSON.parse(raw.toString()||'{}') : {};
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(data===undefined?undefined:JSON.stringify(data));};
    const failure=(status,message,code='VALIDATION')=>reply(status,{status,message,code,fields:{}});
    if(path==='health'||path==='/health') return reply(200,{status:'UP'});
    if(path==='auth/oidc/providers') return reply(200,[{provider:'google',enabled:false},{provider:'gitlab',enabled:false}]);
    if(path==='auth/register') {
      if(users.has(body.email)) return failure(409,'Ya existe una cuenta con ese correo.');
      const user={...body,id:randomUUID(),mfa:false,codes:[]};users.set(body.email,user);
      return reply(201,{id:user.id,name:user.name,email:user.email});
    }
    if(path==='auth/login') {
      const user=users.get(body.email); if(!user||user.password!==body.password) return failure(401,'Correo o contraseña incorrectos.');
      if(user.mfa) { const challengeToken=opaque();challenges.set(challengeToken,user);return reply(200,{mfaRequired:true,enrollmentRequired:false,challengeToken,challengeExpiresAt:new Date(Date.now()+300000).toISOString()}); }
      return reply(200,issue(user));
    }
    if(path==='auth/refresh') {
      const s=refreshes.get(body.refreshToken); if(!s) return failure(401,'La sesión ha expirado.');
      refreshes.delete(body.refreshToken);sessions.delete(s.accessToken);return reply(200,issue(s.user,s));
    }
    if(path==='auth/password-reset/request')return reply(202,{message:'Si la cuenta está disponible, recibirás instrucciones.'});
    if(path==='auth/password-reset/complete')return failure(400,'El enlace es inválido, ha caducado o ya fue utilizado.');
    if(path==='auth/mfa/recover'||path==='auth/mfa/verify') {
      const user=challenges.get(body.challengeToken);if(!user)return failure(401,'El desafío ha caducado.');
      if(path.endsWith('/recover')) { const i=user.codes.indexOf(body.code);if(i<0)return failure(401,'El código ya fue utilizado o no es válido.');user.codes.splice(i,1); }
      challenges.delete(body.challengeToken);return reply(200,issue(user));
    }
    const session=sessions.get((req.headers.authorization||'').replace(/^Bearer /,'')), user=session?.user;
    if(!user)return failure(401,'Inicia sesión para continuar.','UNAUTHORIZED');
    if(path==='auth/logout'){revoke(session);return reply(204);}
    if(path==='users/me')return reply(200,{id:user.id,name:user.name,email:user.email});
    if(path==='users/me/identity')return reply(200,{userId:user.id,role:'USER',enabled:true,version:0});
    if(path.startsWith('admin/'))return failure(403,'Acceso denegado.','FORBIDDEN');
    if(path==='users/me/identities')return reply(200,[]);
    if(path==='users/me/sessions'&&req.method==='GET')return reply(200,[...new Set(sessions.values())].filter(s=>s.user===user).map(s=>({id:s.id,current:s===session,createdAt:s.createdAt,lastSeenAt:now(),absoluteExpiresAt:new Date(Date.now()+7200000).toISOString()})));
    if(path.startsWith('users/me/sessions/')){
      if(parts[3]==='revoke-others')revokeUser(user,session);
      else if(parts[3]==='revoke-all')revokeUser(user);
      else { const target=[...sessions.values()].find(s=>s.id===parts[3]&&s.user===user);revoke(target); }
      return reply(204);
    }
    if(path==='users/me/mfa')return reply(200,{state:user.mfa?'ENABLED':'DISABLED',required:false,localPassword:true,recoveryCodesRemaining:user.codes.length,pendingReplacement:false});
    if(path==='users/me/mfa/enroll'){
      if(body.password!==user.password)return failure(401,'Contraseña incorrecta.');
      user.seed='JBSWY3DPEHPK3PXP';return reply(200,{secret:user.seed,manualKey:user.seed,otpauthUri:`otpauth://totp/SIARE:fixture?secret=${user.seed}&issuer=SIARE`});
    }
    if(path==='users/me/mfa/confirm'){
      user.mfa=true;user.codes=Array.from({length:10},()=>randomBytes(16).toString('base64url'));revokeUser(user);
      return reply(200,{recoveryCodes:user.codes,session:issue(user)});
    }
    if(path==='users/me/mfa/recovery-codes'||path==='users/me/mfa/disable'){
      const i=user.codes.indexOf(body.code);if(body.password!==user.password||i<0)return failure(401,'El código no es válido.');
      revokeUser(user);
      if(path.endsWith('/disable')){user.mfa=false;user.codes=[];return reply(204);}
      user.codes=Array.from({length:10},()=>randomBytes(16).toString('base64url'));return reply(200,{recoveryCodes:user.codes});
    }
    if(path==='subjects'){
      if(req.method==='POST'){const subject={id:randomUUID(),owner:user.id,name:body.name,description:body.description||'',archived:false,version:0,createdAt:now(),updatedAt:now()};subjects.set(subject.id,subject);return reply(201,subject);}
      return reply(200,[...subjects.values()].filter(s=>s.owner===user.id));
    }
    if(parts[0]==='subjects'){
      const subject=subjects.get(parts[1]);if(!subject)return failure(404,'Materia no encontrada.','NOT_FOUND');
      if(subject.owner!==user.id)return failure(403,'Acceso denegado.','FORBIDDEN');
      if(parts.length===2){if(req.method==='PATCH'){Object.assign(subject,body);subject.version++;}return reply(200,subject);}
      if(parts[2]==='archive'){subject.archived=true;subject.version++;return reply(200,subject);}
      if(parts[2]==='documents'){
        if(req.method==='POST'){
          const text=raw.toString('latin1'), name=/filename="([^"]+)"/.exec(text)?.[1]||'fixture.pdf';
          const start=raw.indexOf(Buffer.from('\r\n\r\n'))+4, end=raw.lastIndexOf(Buffer.from('\r\n--')), bytes=raw.subarray(start,end);
          if(bytes.toString().includes('%PDF-corrupt'))return failure(422,'El archivo está dañado.','CORRUPT_DOCUMENT');
          const d={documentId:randomUUID(),subjectId:subject.id,originalFilename:name,contentType:'application/pdf',sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),status:'UPLOADED',createdAt:now(),bytes};documents.set(d.documentId,d);const {bytes:_,...view}=d;return reply(201,view);
        }
        return reply(200,[...documents.values()].filter(d=>d.subjectId===subject.id).reverse().map(({bytes,...d})=>d));
      }
      if(parts[2]==='activities'){
        if(req.method==='POST'){
          if(subject.archived)return failure(409,'La materia está archivada.');
          const activity={activityId:randomUUID(),subjectId:subject.id,documentId:body.documentId||null,type:body.type,title:body.topic,status:'AVAILABLE',createdAt:now(),content:body.type==='QUIZ'?{questions:body.bank.questions.slice(0,body.count).map(({correctOptionId,explanation,source,...q})=>({...q,source:source?{reference:source.reference}:null}))}:structuredClone(crossword)};
          if(activity.type==='CROSSWORD')activity.content.clues.forEach((clue,i)=>{clue.clue=body.bank.words[i]?.clue||clue.clue;});
          activities.set(activity.activityId,{...activity,bank:body.bank});return reply(201,activity);
        }
        const list=[...activities.values()].filter(a=>a.subjectId===subject.id), limit=Number(url.searchParams.get('limit')||20), cursor=url.searchParams.get('cursor'), offset=cursor?list.findIndex(a=>a.activityId===cursor)+1:0;
        return reply(200,{items:list.slice(offset,offset+limit).map(a=>({activityId:a.activityId,subjectId:a.subjectId,type:a.type,title:a.title,available:true})),nextCursor:list.length>offset+limit?list[offset+limit-1].activityId:null});
      }
    }
    if(parts[0]==='documents'){
      const d=documents.get(parts[1]);if(!d||subjects.get(d.subjectId)?.owner!==user.id)return failure(404,'Documento no encontrado.','NOT_FOUND');
      if(parts[2]==='process'){d.status=d.originalFilename.includes('sin-texto')?'FAILED':'READY';d.errorCode=d.status==='FAILED'?'NO_EXTRACTABLE_TEXT':null;return reply(202,{documentId:d.documentId,status:d.status});}
      if(parts[2]==='text')return reply(200,{documentId:d.documentId,pageCount:1,characterCount:100,warnings:d.originalFilename.includes('escaneado')?['OCR_APPLIED']:[],fragments:[{index:0,unitType:'page',unitNumber:1,text:'SOL LUNA. La respuesta de la suma es cuatro. Aprender ciencias con SIARE.'}]});
      if(parts[2]==='download') {res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':d.bytes.length,'Content-Disposition':`attachment; filename="${d.originalFilename}"`});return res.end(d.bytes);}
      const {bytes,...view}=d;return reply(200,view);
    }
    if(parts[0]==='activities'){
      const a=activities.get(parts[1]);if(!a)return failure(404,'Actividad no encontrada.','NOT_FOUND');
      if(subjects.get(a.subjectId)?.owner!==user.id)return failure(403,'Acceso denegado.','FORBIDDEN');
      if(parts.length===2){const {bank,...view}=a;return reply(200,view);}
      if(parts[2]==='submissions'){
        if(req.method==='POST'){
          if(Object.keys(body).some(key=>!['idempotencyKey','answers','durationMs'].includes(key)))return failure(400,'Campos no admitidos.');
          const key=a.activityId+':'+body.idempotencyKey;let result=attempts.get(key);
          if(!result&&subjects.get(a.subjectId).archived)return failure(409,'La materia está archivada.');
          if(!result){result={attemptId:randomUUID(),eventId:randomUUID(),studentId:user.id,subjectId:a.subjectId,activityId:a.activityId,activityType:a.type,score:1,percentage:100,points:2,total:2,durationMs:body.durationMs,occurredAt:now(),feedback:'Evaluación del proveedor controlado.',items:[]};attempts.set(key,result);attempts.set(result.attemptId,result);}
          return reply(200,result);
        }
        const result=attempts.get(parts[3]);return result?reply(200,result):failure(404,'Intento no encontrado.','NOT_FOUND');
      }
    }
    return failure(404,'Ruta no definida en el proveedor de prueba.','NOT_FOUND');
  } catch {res.writeHead(500,{'Content-Type':'application/json'});res.end('{"message":"Fixture failure"}');}
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
const environment=Object.fromEntries(['PATH','SystemRoot','WINDIR','TEMP','TMP'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env:{...environment,CORE_API_URL:`http://127.0.0.1:${upstream.address().port}`,APP_ORIGIN:`http://127.0.0.1:${port}`,SESSION_COOKIE_SECURE:'false',NEXT_TELEMETRY_DISABLED:'1'}});
const close=()=>{app.kill();upstream.close();};process.on('SIGINT',close);process.on('SIGTERM',close);app.on('exit',()=>upstream.close());

// Test-only loopback upstream. Never used by Docker or a product route.
// Lets UI checks run without writing accounts or academic data to the installation.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.APPEARANCE_TEST_PORT || 3128);
const subjects = new Map();
const activities = new Map();
const crossword = JSON.parse(await readFile(new URL('./fixtures/h3/crossword.json',import.meta.url),'utf8'));
const upstream = createServer(async (req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const path=req.url.replace('/api/v1/','').split('?')[0], body=JSON.parse(raw||'{}');
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(data===undefined?undefined:JSON.stringify(data));};
  const me={id:'00000000-0000-4000-8000-000000000001',name:'Estudiante de prueba H6',email:'appearance@example.test'};
  if(path==='users/me')return reply(200,me);
  if(path==='users/me/identity')return reply(200,{userId:me.id,role:'USER',enabled:true,version:0});
  if(path==='auth/register')return reply(201,me);
  if(path==='auth/login')return reply(200,{accessToken:'isolated-appearance-fixture',refreshToken:'isolated-refresh',expiresAt:new Date(Date.now()+3600000).toISOString(),refreshExpiresAt:new Date(Date.now()+7200000).toISOString()});
  if(path==='auth/logout')return reply(204);
  if(path==='auth/oidc/providers')return reply(200,[]);
  if(path==='health'||req.url==='/health')return reply(200,{status:'UP'});
  if(path==='subjects'){
    if(req.method==='POST'){const s={id:randomUUID(),name:body.name,description:body.description||'',archived:false,version:0};subjects.set(s.id,s);return reply(201,s);}
    return reply(200,[...subjects.values()]);
  }
  if(/^subjects\/[^/]+$/.test(path))return reply(200,subjects.get(path.split('/')[1]));
  if(path.endsWith('/documents'))return reply(200,[]);
  if(/^subjects\/[^/]+\/activities$/.test(path)){
    const subjectId=path.split('/')[1];
    if(req.method==='POST'){
      const activity={activityId:randomUUID(),subjectId,documentId:null,type:body.type,title:body.topic,status:'AVAILABLE',createdAt:new Date().toISOString(),content:body.type==='QUIZ'?{questions:body.bank.questions.slice(0,body.count).map(({correctOptionId,explanation,...question})=>question)}:crossword.content};
      activities.set(activity.activityId,activity);return reply(201,activity);
    }
    return reply(200,{items:[...activities.values()].filter(a=>a.subjectId===subjectId).map(({activityId,subjectId,type,title})=>({activityId,subjectId,type,title,available:true})),nextCursor:null});
  }
  if(/^activities\/[^/]+$/.test(path))return reply(200,activities.get(path.split('/')[1]));
  if(path==='users/me/sessions'||path==='users/me/identities')return reply(200,[]);
  if(path==='users/me/mfa')return reply(200,{state:'DISABLED',required:false,localPassword:true});
  return reply(404,{message:'Ruta no definida en la fixture de apariencia.'});
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env:{...process.env,CORE_API_URL:`http://127.0.0.1:${upstream.address().port}`,APP_ORIGIN:`http://127.0.0.1:${port}`,SESSION_COOKIE_SECURE:'false',NEXT_TELEMETRY_DISABLED:'1'}});
const close=()=>{app.kill();upstream.close();};process.on('SIGINT',close);process.on('SIGTERM',close);app.on('exit',()=>upstream.close());

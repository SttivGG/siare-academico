// Solo documentación. Usa Playwright ya instalado; no inicia SIARE ni Docker.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here,'../../..');
const runner = process.env.H6_PLAYWRIGHT_MODULE || path.resolve(repo,'../../frontend/node_modules/@playwright/test/index.mjs');
const { chromium } = await import(pathToFileURL(runner).href);
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if(!executablePath && process.platform==='win32'){
  const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  const installed=(await readdir(cache)).filter(p=>/^chromium-\d+$/.test(p)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  executablePath=installed.map(p=>path.join(cache,p,'chrome-win64/chrome.exe')).find(existsSync);
}
const out=path.resolve(repo,'docs/design/evidencias/h6-1');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true});
const result={capturedAt:new Date().toISOString(),browser:browser.version(),scope:'local documentation prototype; no SIARE API',captures:[],checks:[],errors:[]};
const url=(params={})=>`${pathToFileURL(path.join(here,'prototipo.html')).href}?${new URLSearchParams(params)}`;
try{
 const context=await browser.newContext({locale:'es-CO',timezoneId:'America/Bogota',reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 const traffic=[];page.on('request',r=>{if(/^https?:/.test(r.url()))traffic.push(r.url());});
 async function shot(name,fullPage=false){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,name+'.png'),fullPage});result.captures.push({file:name+'.png',viewport:page.viewportSize(),fullPage});}
 for(const layout of ['a','b'])for(const theme of ['light','dark'])for(const [device,width,height]of [['desktop',1440,1000],['tablet',1024,900],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(url({layout,theme}));
  await shot(`${layout}-${theme}-${device}`);
  const geometry=await page.evaluate(()=>{const box=s=>{const el=document.querySelector(s);const r=el.getBoundingClientRect();return {width:r.width,height:r.height,y:r.y,visible:getComputedStyle(el).display!=='none'};};return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,center:box('.center-panel'),sources:box('.sources-panel'),study:box('.study-panel'),font:document.fonts.check('16px Urbanist')};});
  result.checks.push({layout,theme,device,...geometry});
 }
 for(const theme of ['light','dark']){
  await page.setViewportSize({width:1440,height:1050});await page.goto(url({theme,screen:'system'}));await shot(`componentes-${theme}`,true);
  await page.getByRole('button',{name:'Revisar confirmación de archivo'}).click();await shot(`dialogo-${theme}`);
  result.checks.push({theme,dialogOpen:await page.locator('#confirm-demo').evaluate(el=>el.open),focusInDialog:await page.evaluate(()=>document.querySelector('#confirm-demo').contains(document.activeElement))});
  await page.keyboard.press('Escape');
  result.checks.push({theme,escapeClosesDialog:await page.locator('#confirm-demo').evaluate(el=>!el.open),focusRestored:await page.getByRole('button',{name:'Revisar confirmación de archivo'}).evaluate(el=>el===document.activeElement)});
 }
 for(const [name,params,width,height]of [
  ['a-light-mobile-fuentes',{layout:'a',theme:'light',panel:'sources'},390,844],
  ['a-dark-mobile-estudio',{layout:'a',theme:'dark',panel:'study'},390,844],
  ['b-light-tablet-fuentes',{layout:'b',theme:'light',panel:'sources'},1024,900],
  ['b-dark-mobile-banco',{layout:'b',theme:'dark',task:'bank'},390,844],
  ['a-light-lectura',{layout:'a',theme:'light',task:'reading'},1440,1000]
 ]){await page.setViewportSize({width,height});await page.goto(url(params));await shot(name);}
 // Comprobaciones limitadas al prototipo; no acreditan correcciones en React/SIARE.
 await page.setViewportSize({width:1440,height:1000});await page.goto(url({layout:'a',theme:'light'}));
 await page.getByRole('radio').first().check();await page.getByRole('button',{name:'Preparar banco',exact:true}).click();
 await page.getByLabel('Tema del banco').fill('Conservar mi borrador');await page.locator('.tool[data-task=quiz]').click();
 const answer=await page.getByRole('radio').first().isChecked();
 await page.getByRole('button',{name:'Preparar banco',exact:true}).click();
 const draft=await page.getByLabel('Tema del banco').inputValue()==='Conservar mi borrador';
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fuentes',exact:true}).click();
 await page.getByRole('button',{name:'Aprendizaje',exact:true}).click();
 const mobileDraft=await page.getByLabel('Tema del banco').inputValue()==='Conservar mi borrador';
 result.checks.push({prototypeOnly:true,answerPreserved:answer,bankPreserved:draft,bankPreservedAfterResize:mobileDraft});
 for(const layout of ['a','b'])for(const width of [320,375,768,1366,1920]){
  await page.setViewportSize({width,height:900});await page.goto(url({layout,theme:'dark'}));
  result.checks.push({layout,width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(url({layout:'a',theme:'light'}));await page.keyboard.press('Tab');
 const firstFocus=await page.evaluate(()=>({text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outline}));
 await shot('foco-light');result.checks.push({firstFocus,externalRequests:traffic});
 result.checks.push({domInvalidDate:await page.getByText('Invalid Date',{exact:false}).count()});
 await page.setViewportSize({width:390,height:844});await page.goto(url({layout:'a',theme:'light'}));await shot('a-light-mobile-completo',true);
 await page.setViewportSize({width:1440,height:1000});await page.goto(url({layout:'a',theme:'light'}));
 await page.getByRole('button',{name:'Cambiar tema'}).click();
 result.checks.push({themeToggleChangesRoot:await page.evaluate(()=>document.documentElement.dataset.theme==='dark'&&getComputedStyle(document.documentElement).colorScheme==='dark')});
 await page.goto(pathToFileURL(path.join(here,'index.html')).href);await shot('galeria',true);
 await writeFile(path.join(out,'validacion.json'),JSON.stringify(result,null,2)+'\n');
 if(result.errors.length || traffic.length || result.checks.some(x=>x.overflow||x.documentWidth>x.width||x.prototypeOnly&&(!x.answerPreserved||!x.bankPreserved||!x.bankPreservedAfterResize)))throw Error('Prototype validation failed; review validacion.json');
 console.log(JSON.stringify({captures:result.captures.length,checks:result.checks,errors:result.errors},null,2));
}finally{await browser.close();}

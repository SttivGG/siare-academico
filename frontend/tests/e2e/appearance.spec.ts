import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
const output=process.env.APPEARANCE_EVIDENCE_DIR??'../.cache/h6-appearance';
const sizes=[[1920,1080],[1440,900],[1024,768],[768,1024],[390,844],[320,844]];
async function setup(page:Page,origin:string){
  const headers={Origin:origin,'X-SIARE-CSRF':'1'};
  const credentials={name:'Estudiante de prueba H6',email:`appearance-${randomUUID()}@example.test`,password:`Apariencia de prueba ${randomUUID()}`};
  expect((await page.request.post('/api/bff/auth/register',{headers,data:credentials})).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login',{headers,data:credentials})).status()).toBe(200);
  const response=await page.request.post('/api/bff/subjects',{headers,data:{name:'Cuaderno de apariencia',description:'Contenido sintético de verificación.'}});
  expect(response.status()).toBe(201);return (await response.json()).id as string;
}
async function account(page:Page){
  const trigger=page.locator('summary[aria-label="Menú de cuenta"]');
  if(!await trigger.isVisible())await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
  if(await trigger.locator('..').getAttribute('open')===null)await trigger.click();
  return trigger;
}
async function range(page:Page,name:string,value:string){
  const input=page.getByRole('slider',{name:new RegExp('^'+name)});
  await input.evaluate((element,value)=>{const el=element as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await expect(input).toHaveValue(value);
}

test('appearance: both themes, both navigation states and the six requested viewports',async({page,baseURL})=>{
  test.setTimeout(180000);await mkdir(output,{recursive:true});await setup(page,baseURL!);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/configuracion/apariencia');await expect(page.getByRole('heading',{name:'Apariencia',exact:true})).toBeVisible();
  const checks:object[]=[];
  for(const theme of ['light','dark']){
    await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);
    for(const [width,height]of sizes){
      await page.setViewportSize({width,height});
      for(const expanded of [false,true]){
        if(width>700){
          if(await page.locator('html').getAttribute('data-rail')!==(expanded?'expanded':'collapsed'))await page.getByRole('button',{name:expanded?'Expandir navegación':'Contraer navegación',exact:true}).click();
          const rail=await page.getByRole('complementary',{name:'Barra de navegación'}).boundingBox();
          expect(rail!.x).toBe(0);expect(rail!.y).toBe(0);expect(rail!.width).toBe(expanded?232:72);expect(rail!.height).toBe(height);
          const header=await page.locator('header').boundingBox();expect(header!.x).toBeGreaterThanOrEqual(rail!.width);expect(header!.height).toBe(56);
          const profile=await page.locator('summary[aria-label="Menú de cuenta"]').boundingBox();expect(profile!.y+profile!.height).toBeGreaterThan(height-24);
        }else{
          await expect(page.getByRole('button',{name:'Abrir navegación',exact:true})).toBeVisible();
          if(expanded)await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
        }
        await page.evaluate(()=>{scrollTo(0,0);return document.fonts.ready;});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect(page.locator('header summary')).toHaveCount(0);
        const file=`appearance-${theme}-${expanded?'expanded':'collapsed'}-${width}x${height}.jpg`;
        await page.screenshot({path:`${output}/${file}`,type:'jpeg',quality:82});
        checks.push({theme,expanded,width,height,file});
        if(width<=700&&expanded)await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({width:1440,height:900});
  }
  expect(errors).toEqual([]);await writeFile(`${output}/visual-matrix.json`,JSON.stringify({scope:process.env.APPEARANCE_TEST_SCOPE||'production Next with isolated in-memory upstream; no real authorization claim',checks,errors},null,2));
});

test('appearance: account at the bottom, keyboard, exterior close, focus and no clipping',async({page,baseURL})=>{
  await setup(page,baseURL!);await page.setViewportSize({width:1440,height:900});await page.goto('/configuracion/apariencia');
  for(const expanded of [false,true]){
    if(expanded)await page.getByRole('button',{name:'Expandir navegación',exact:true}).click();
    const trigger=await account(page);await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Cuenta y seguridad',exact:true})).toBeFocused();
    await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Mis sesiones',exact:true})).toBeFocused();
    await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Apariencia',exact:true})).toBeFocused();
    const menu=await trigger.locator('..').locator('div').first().boundingBox();expect(menu!.x).toBeGreaterThanOrEqual(0);expect(menu!.y).toBeGreaterThanOrEqual(0);expect(menu!.x+menu!.width).toBeLessThanOrEqual(1440);expect(menu!.y+menu!.height).toBeLessThanOrEqual(900);
    await page.screenshot({path:`${output}/account-${expanded?'expanded':'collapsed'}.jpg`,quality:82});
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    await trigger.click();await page.getByRole('heading',{name:'Apariencia',exact:true}).click();await expect(trigger.locator('..')).not.toHaveAttribute('open');
    await trigger.click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).focus();await page.keyboard.press('Tab');await expect(trigger.locator('..')).not.toHaveAttribute('open');
  }
  await page.setViewportSize({width:320,height:844});const trigger=await account(page);
  const box=await trigger.locator('..').locator('div').first().boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);expect(box!.y).toBeGreaterThan(0);
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir navegación',exact:true})).toBeFocused();
});

test('appearance: gallery, live tokens, reload, tab synchronization, system and exact reset',async({page,context,baseURL})=>{
  await setup(page,baseURL!);await page.goto('/configuracion/apariencia');await page.setViewportSize({width:1440,height:900});
  const other=await context.newPage();await other.goto('/login');
  for(const [label,id]of [['Biblioteca moderna','library'],['Espacio de estudio minimalista','minimal'],['Aprendizaje colaborativo','collaborative'],['Sala de lectura contemporánea','reading'],['Sin imagen','none'],['Fondo educativo actual','education']]){
    await page.getByRole('radio',{name:new RegExp(label+'$')}).check();await expect(other.locator('html')).toHaveAttribute('data-background',id);
    expect(await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage)).toContain(id==='none'?'none':id==='education'?'study-background':id);
  }
  await page.getByRole('radio',{name:'Biblioteca moderna',exact:true}).check();await range(page,'Transparencia del cristal','25');await range(page,'Desenfoque','24');await range(page,'Velo neutro del fondo','100');
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');
  await expect(other.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await other.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blur').trim())).toBe('24px');
  await page.reload();await expect(page.getByRole('slider',{name:/^Desenfoque/})).toHaveValue('24');await expect(page.getByRole('radio',{name:'Biblioteca moderna',exact:true})).toBeChecked();
  for(const [name,value,file]of [['Transparencia del cristal','72','transparency-72'],['Transparencia del cristal','20','transparency-20'],['Desenfoque','0','blur-0'],['Desenfoque','24','blur-24']]){
    await range(page,name,value);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${file}.jpg`,quality:82});
    await page.getByRole('region',{name:'Luz y profundidad',exact:true}).screenshot({path:`${output}/${file}-controls.jpg`,type:'jpeg',quality:82});
  }
  await page.getByRole('button',{name:'Restaurar apariencia predeterminada',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Tema',exact:true})).toHaveValue('system');await expect(page.getByRole('radio',{name:'Fondo educativo actual',exact:true})).toBeChecked();
  await expect(page.getByRole('slider',{name:/^Transparencia del cristal/})).toHaveValue('72');await expect(page.getByRole('slider',{name:/^Desenfoque/})).toHaveValue('10');await expect(page.getByRole('slider',{name:/^Velo neutro del fondo/})).toHaveValue('50');
  await page.emulateMedia({colorScheme:'dark'});await expect(page.getByRole('button',{name:'Tema oscuro',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({colorScheme:'light'});await expect(page.getByRole('button',{name:'Tema oscuro',exact:true})).toHaveAttribute('aria-pressed','false');
  for(const theme of ['light','dark']){
    await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);
    await page.getByRole('group',{name:'Imagen de fondo',exact:true}).screenshot({path:`${output}/gallery-${theme}.jpg`,type:'jpeg',quality:85});
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/appearance-complete-${theme}.jpg`,type:'jpeg',quality:80,fullPage:true});
  }
  await other.close();
});

for(const denied of [false,true])test(`ST-09/10: bottom account logout ${denied?'reports denied recovery purge':'purges the encrypted recovery copy'}`,async({page,baseURL})=>{
  const id=await setup(page,baseURL!);await page.goto(`/materias/${id}`);await page.getByRole('button',{name:'Preparar banco',exact:true}).click();await page.getByLabel('Editar banco JSON').fill('{"privado":"borrador de prueba"}');
  await page.getByRole('button',{name:'Habilitar recuperación local',exact:true}).click();await page.getByLabel('Frase local de recuperación').fill('Frase local de pruebas de apariencia');await page.getByLabel('Autorizo una copia local cifrada').check();await page.getByRole('button',{name:'Habilitar copia cifrada',exact:true}).click();
  await page.getByRole('button',{name:'Guardar copia ahora',exact:true}).click();await expect(page.locator('.academic-recovery > p')).toContainText('Copia cifrada guardada');
  if(denied)await page.evaluate(()=>{Object.defineProperty(indexedDB,'open',{configurable:true,value:()=>{throw new DOMException('test denied','SecurityError');}});});
  let requests=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/auth/logout'))requests++;});
  await account(page);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(page).toHaveURL(denied?/\/login\?copia=error-al-eliminar/:/\/login$/);expect(requests).toBe(1);
  expect((await page.context().cookies()).some(c=>c.name==='siare_session'||c.name==='siare_refresh')).toBe(false);
  if(!denied){const count=await page.evaluate(()=>new Promise<number>(resolve=>{const request=indexedDB.open('siare-academic-recovery',1);request.onsuccess=()=>{const db=request.result,query=db.transaction('copies').objectStore('copies').count();query.onsuccess=()=>{db.close();resolve(query.result);};};}));expect(count).toBe(0);}
});

test('appearance: bank DOM and review survive rail and cross-tab appearance updates',async({page,context,baseURL})=>{
  const id=await setup(page,baseURL!);await page.setViewportSize({width:1440,height:900});await page.goto(`/materias/${id}`);
  await page.getByRole('button',{name:'Preparar banco',exact:true}).click();
  const editor=page.getByLabel('Editar banco JSON');await editor.fill('{"borrador":"continúa en el cuaderno"}');
  const node=await editor.elementHandle();
  await page.getByRole('button',{name:'Expandir navegación',exact:true}).click();await expect(editor).toHaveValue('{"borrador":"continúa en el cuaderno"}');
  await page.getByRole('button',{name:'Contraer navegación',exact:true}).click();
  const settings=await context.newPage();await settings.goto('/configuracion/apariencia');await settings.getByRole('radio',{name:'Sala de lectura contemporánea',exact:true}).check();await range(settings,'Desenfoque','0');await range(settings,'Transparencia del cristal','25');
  await expect(page.locator('html')).toHaveAttribute('data-background','reading');
  expect(await node!.evaluate(el=>el.isConnected)).toBe(true);await expect(editor).toHaveValue('{"borrador":"continúa en el cuaderno"}');
  await account(page);await page.getByRole('link',{name:'Apariencia',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Salir del cuaderno',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Seguir trabajando',exact:true}).click();
  await expect(editor).toHaveValue('{"borrador":"continúa en el cuaderno"}');
  await page.screenshot({path:`${output}/cuaderno-background.jpg`,quality:82});await settings.close();
});

test('appearance: blocked storage keeps session choices; invalid preferences and access stay bounded',async({page,context,baseURL})=>{
  await page.goto('/configuracion/apariencia');await expect(page).toHaveURL(/\/login/);
  await setup(page,baseURL!);await page.goto('/configuracion/apariencia');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked for test');};});
  await page.getByRole('radio',{name:'Biblioteca moderna',exact:true}).check();await range(page,'Desenfoque','20');
  await expect(page.locator('.appearance-notice')).toBeVisible();
  await page.getByRole('link',{name:'SIARE · Inicio',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-background','library');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blur').trim())).toBe('20px');
  await context.clearCookies();
});

test('appearance: only selected image plus small thumbnails load; preferences respect accessibility',async({page,baseURL})=>{
  await setup(page,baseURL!);const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/images/'))requests.push(r.url());});
  await page.goto('/configuracion/apariencia');await page.getByRole('radio',{name:/Sin imagen$/}).scrollIntoViewIfNeeded();
  expect(requests.filter(url=>/\/(library|minimal|collaborative|reading)\.webp/.test(url))).toEqual([]);
  await range(page,'Desenfoque','24');await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blur').trim())).toBe('0px');
  expect(await page.evaluate(()=>getComputedStyle(document.body,'::before').display)).toBe('none');
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.emulateMedia({forcedColors:'none'});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blur').trim())).toBe('0px');
  await cdp.detach();
});

test('ST-03/04/05: real Quiz and Crossword components retain nodes and answers while appearance changes',async({page,context,baseURL})=>{
  const subject=await setup(page,baseURL!),headers={Origin:baseURL!,'X-SIARE-CSRF':'1'};
  const question={id:'q1',prompt:'Pregunta revisada',options:[{id:'a',text:'Primera opción'},{id:'b',text:'Segunda opción'}],correctOptionId:'a',explanation:'Banco de prueba.',topic:'Repaso'};
  const bank={validated:true,questions:[question,{...question,id:'q2',prompt:'Otra pregunta revisada'}],words:[{id:'w1',answer:'SOL',clue:'Estrella.',topic:'Repaso'},{id:'w2',answer:'LUNA',clue:'Satélite.',topic:'Repaso'}]};
  const ids:string[]=[];
  for(const type of ['QUIZ','CROSSWORD']){const response=await page.request.post(`/api/bff/subjects/${subject}/activities`,{headers,data:{type,topic:'Repaso',count:2,gridSize:15,bank}});expect(response.status()).toBe(201);ids.push((await response.json()).activityId);}
  await page.goto(`/materias/${subject}`);
  async function open(id:string){const picker=page.locator('.catalog-picker');if(await picker.getAttribute('open')===null)await picker.locator('summary').click();await page.locator(`[data-activity-id="${id}"]`).click();}
  await open(ids[0]);await page.getByRole('radio',{name:'Primera opción',exact:true}).check();
  const quizNode=await page.locator('.activity-player').elementHandle();
  const settings=await context.newPage();await settings.goto('/configuracion/apariencia');
  await settings.getByRole('radio',{name:'Biblioteca moderna',exact:true}).check();await range(settings,'Transparencia del cristal','20');
  await expect(page.locator('html')).toHaveAttribute('data-background','library');await expect(page.getByRole('radio',{name:'Primera opción',exact:true})).toBeChecked();
  expect(await quizNode!.evaluate(el=>el.isConnected)).toBe(true);
  await page.getByRole('button',{name:'Expandir navegación',exact:true}).click();await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await open(ids[1]);const first=page.locator('.crossword-cell input').first();await first.fill('S');const cell=await first.elementHandle();
  await settings.getByRole('radio',{name:'Aprendizaje colaborativo',exact:true}).check();await range(settings,'Desenfoque','24');await settings.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await cell!.evaluate(el=>el.isConnected)).toBe(true);await expect(first).toHaveValue('S');
  await page.screenshot({path:`${output}/crossword-background-dark.jpg`,quality:82});
  await open(ids[0]);await expect(page.getByText('Pregunta 2 de 2',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Anterior',exact:true}).click();await expect(page.getByRole('radio',{name:'Primera opción',exact:true})).toBeChecked();
  await settings.close();
});

test('appearance: rendered text contrast across every background at the most transparent setting',async({page,baseURL})=>{
  test.setTimeout(180000);await setup(page,baseURL!);await page.goto('/configuracion/apariencia');
  await range(page,'Velo neutro del fondo','0');await range(page,'Desenfoque','0');
  const luminance=(rgb:number[])=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const results:object[]=[],failures:object[]=[];
  for(const theme of ['light','dark'])for(const background of ['Fondo educativo actual','Biblioteca moderna','Espacio de estudio minimalista','Aprendizaje colaborativo','Sala de lectura contemporánea','Sin imagen']){
    await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await page.getByRole('radio',{name:new RegExp(background+'$')}).check();
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>{scrollTo(0,0);return document.fonts.ready;});
      const items=await page.evaluate(()=>[...document.querySelectorAll('main h1,main h2,main h3,main p,main label,main .small-label')].flatMap(el=>{
        const css=getComputedStyle(el);const text=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim());if(!text||!el.getClientRects().length)return [];
        const range=document.createRange();range.selectNodeContents(text);
        return [...range.getClientRects()].map(r=>({text:text.textContent!.trim(),color:css.color.match(/[\d.]+/g)!.slice(0,3).map(Number),x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,target:parseFloat(css.fontSize)>=24?3:4.5}));
      }));
      const hide=await page.addStyleTag({content:'main h1,main h2,main h3,main p,main label,main span,main output,main button,main input {color:transparent!important;text-shadow:none!important;} main input {visibility:hidden!important;}'});
      const {data,info}=await sharp(await page.screenshot({fullPage:true})).removeAlpha().raw().toBuffer({resolveWithObject:true});
      for(const item of items){
        let minimum=Infinity;
        for(let y=Math.ceil(item.y+3);y<Math.min(info.height,item.y+item.height-3);y+=6)for(let x=Math.max(0,Math.ceil(item.x+3));x<Math.min(info.width,item.x+item.width-3);x+=6){const at=(y*info.width+x)*3;const a=luminance(item.color),b=luminance([...data.subarray(at,at+3)]);minimum=Math.min(minimum,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));}
        const result={theme,background,width,text:item.text,ratio:Number(minimum.toFixed(2)),target:item.target};results.push(result);if(minimum+.01<item.target)failures.push(result);
      }
      await hide.evaluate(el=>el.remove());
    }
    await page.setViewportSize({width:1440,height:900});
  }
  await writeFile(`${output}/background-contrast.json`,JSON.stringify({method:'Rendered samples with text hidden; transparency 72%, blur 0px, veil 0%; both themes, six backgrounds, 1440/390. Sampling is not WCAG certification.',results,failures},null,2));
  expect(failures).toEqual([]);
});

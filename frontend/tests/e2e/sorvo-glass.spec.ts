import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const output = process.env.SORVO_EVIDENCE_DIR ?? '../.cache/h6-sorvo-visual';
const luminance = (rgb: number[]) => rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);

async function student(page: Page, origin: string) {
  const headers={Origin:origin,'X-SIARE-CSRF':'1'};
  const credentials={name:'Estudiante de cristal',email:`glass-check-${randomUUID()}@example.test`,password:`Contraste y continuidad ${randomUUID()}`};
  expect((await page.request.post('/api/bff/auth/register',{headers,data:credentials})).status()).toBe(201);
  expect((await page.request.post('/api/bff/auth/login',{headers,data:{email:credentials.email,password:credentials.password}})).status()).toBe(200);
  const response=await page.request.post('/api/bff/subjects',{headers,data:{name:'Programación avanzada',description:'Fuentes y actividades para estudiar.'}});
  expect(response.status()).toBe(201); return (await response.json()).id as string;
}

test('SIARE glass: rendered backgrounds transmit through every primary surface; text contrast and reading protection', async ({page,baseURL},info)=>{
  test.skip(info.project.name!=='desktop','La prueba incluye escritorio y móvil en ambos temas.');
  test.setTimeout(240_000); await mkdir(output,{recursive:true});
  const id=await student(page,baseURL!);
  const routes=[['landing','/','[role=tabpanel]'],['inicio','/inicio','[class*="_dashboardHero"]'],['materias','/materias','.subject-card'],['cuaderno',`/materias/${id}`,'.learning-panel'],['seguridad','/seguridad','[class*="_surface"]'],['login','/login','[class*="_authCard"]']];
  const contrasts: object[]=[],optics: object[]=[],failures: object[]=[],errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['light','dark']) for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/'); await page.evaluate(t=>{localStorage.setItem('siare-theme',t);document.documentElement.dataset.theme=t;},theme);
    for(const [name,route,surface] of routes) {
      await page.goto(route); await page.evaluate(()=>document.fonts.ready);
      for(const message of ['Cargando tus materias…','Cargando documentos…','Consultando actividades…','Cargando identidades…']) await expect(page.getByText(message,{exact:true})).toHaveCount(0);
      if(name==='cuaderno' && width<701) await page.getByRole('button',{name:'Aprendizaje',exact:true}).click();
      await page.evaluate(()=>scrollTo(0,0));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const file=`${name}-${theme}-${width}.png`;
      await page.screenshot({path:`${output}/${file}`,fullPage:true});
      const items=await page.evaluate(()=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
        return [...document.querySelectorAll('main h1,main h2,main h3,main p,main label,main .hint,main .eyebrow,main button,main a,main summary,main dt,main dd,footer span')].flatMap(el=>{
          const css=getComputedStyle(el);if(css.visibility==='hidden' || (el as HTMLButtonElement).disabled)return [];
          const text=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent?.trim());if(!text)return [];
          const range=document.createRange();range.selectNodeContents(text);
          ctx.clearRect(0,0,1,1);ctx.fillStyle=css.color;ctx.fillRect(0,0,1,1);
          return [...range.getClientRects()].filter(rect=>rect.width>0 && rect.height>0 && rect.y>=0).map(rect=>({text:text.textContent!.trim(),color:[...ctx.getImageData(0,0,1,1).data].slice(0,3),x:rect.x+scrollX,y:rect.y+scrollY,width:rect.width,height:rect.height,target:parseFloat(css.fontSize)>=24 || parseFloat(css.fontSize)>=18.66 && parseInt(css.fontWeight)>=700?3:4.5}));
        });
      });
      // Fixed navigation overlays content in a full-page screenshot; measure the
      // underlying text as it is read after scrolling it above the navigation.
      const hide=await page.addStyleTag({content:'main h1,main h2,main h3,main h4,main p,main span,main label,main a,main button,main summary,main dt,main dd,footer { color:transparent!important;text-shadow:none!important; } [class*="_workspaceNavigation"],main input[type=checkbox],main input[type=radio] {visibility:hidden!important;}'});
      const {data,info:png}=await sharp(await page.screenshot({fullPage:true})).removeAlpha().raw().toBuffer({resolveWithObject:true});
      for(const item of items){
        let minimum=Infinity;
        for(let y=Math.ceil(item.y+3);y<Math.min(png.height,item.y+item.height-3);y+=4)for(let x=Math.max(0,Math.ceil(item.x+3));x<Math.min(png.width,item.x+item.width-3);x+=4){
          const at=(y*png.width+x)*3;const a=luminance(item.color),b=luminance([...data.subarray(at,at+3)]);minimum=Math.min(minimum,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));
        }
        const result={name,theme,width,text:item.text,ratio:Number(minimum.toFixed(2)),target:item.target};contrasts.push(result);
        if(minimum+0.01<item.target)failures.push(result);
      }
      await hide.evaluate(el=>el.remove());
      // Hide children only for an empty optical probe, preserving the actual surface.
      const panel=name==='landing'?page.locator('[role=tabpanel]').locator('..'):page.locator(surface).first();
      await expect(panel).toBeVisible();
      const bounds=await panel.boundingBox();expect(bounds).not.toBeNull();
      await panel.evaluate(el=>el.setAttribute('data-optical-probe',''));
      const noContent=await page.addStyleTag({content:'[data-optical-probe] > * {visibility:hidden!important;}'});
      await panel.scrollIntoViewIfNeeded();
      const rect=await panel.evaluate(el=>{const r=el.getBoundingClientRect();const c=getComputedStyle(el);return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,color:c.backgroundColor,blur:c.backdropFilter};});
      const crop={left:Math.ceil(rect.x+24),top:Math.ceil(rect.y+24),width:Math.max(1,Math.floor(rect.width-48)),height:20};
      const pixels=async()=>sharp(await page.screenshot({fullPage:true})).extract(crop).removeAlpha().raw().toBuffer();
      const photo=await pixels();
      const probe=await page.addStyleTag({content:'body::before, [class*="_landing"]::before {background:linear-gradient(90deg,#00ffff,#ff00ff)!important;}'});
      const changed=await pixels();let sum=0,count=0;for(let i=0;i<photo.length;i++){const difference=Math.abs(photo[i]-changed[i]);sum+=difference;if(difference>5)count++;}
      const mean=sum/photo.length,fraction=count/photo.length;optics.push({name,theme,width,rect,meanChannelDifference:mean,changedFraction:fraction});
      expect(mean,`${name} ${theme}: an opaque panel cannot transmit the probe`).toBeGreaterThan(10);expect(fraction).toBeGreaterThan(.5);
      await probe.evaluate(el=>el.remove());await noContent.evaluate(el=>el.remove());await panel.evaluate(el=>el.removeAttribute('data-optical-probe'));
    }
  }
  await writeFile(`${output}/contrast.json`,JSON.stringify({method:'Computed text colors against rendered backgrounds with glyphs hidden. Visible text nodes, 1440/390, both themes; not a complete WCAG audit.',contrasts,failures},null,2));
  await writeFile(`${output}/glass-optics.json`,JSON.stringify({method:'Hide descendants without changing the real surface; replace only the photographic backdrop with a color probe and compare RGB in an interior strip. Opaque surfaces give zero transmission.',optics},null,2));
  await page.goto(`/materias/${id}`);
  if(await page.getByRole('navigation',{name:'Paneles del cuaderno'}).isVisible())await page.getByRole('button',{name:'Aprendizaje',exact:true}).click();
  await page.getByRole('button',{name:'Lectura',exact:true}).click();
  await expect(page.locator('.academic-reading')).toHaveCSS('backdrop-filter','none');
  await page.getByRole('button',{name:'Preparar banco',exact:true}).click();
  await expect(page.locator('.bank-editor')).toHaveCSS('backdrop-filter','none');
  expect(errors).toEqual([]);expect(failures,'Text samples below the applicable contrast threshold').toEqual([]);
});

test('SIARE glass: system theme, forced colors, reduced transparency and no-blur fallback remain usable',async({page})=>{
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.goto('/login');
  await expect(page.locator('body')).toHaveCSS('color','rgb(245, 245, 245)');
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light');await expect(page.locator('body')).toHaveCSS('color','rgb(32, 33, 36)');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await expect(page.locator('[class*="_authCard"]')).toHaveCSS('backdrop-filter','blur(0px)');
  await expect(page.locator('[class*="_authCard"]')).toHaveCSS('background-color','rgb(242, 243, 244)');
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();
  // Exercise the actual @supports fallback declarations in a supporting browser.
  const rules=await page.evaluate(()=>{
    const matches:string[]=[];const walk=(rules:CSSRuleList)=>{for(const rule of rules){if(rule instanceof CSSSupportsRule && rule.conditionText.includes('backdrop-filter') && rule.conditionText.startsWith('not'))matches.push(...[...rule.cssRules].map(r=>r.cssText));else if('cssRules' in rule)walk((rule as CSSGroupingRule).cssRules);}};
    for(const sheet of document.styleSheets){try{walk(sheet.cssRules);}catch{}}
    return matches.join('\n');
  });expect(rules).toContain('--glass-primary');
  await page.addStyleTag({content:rules});
  for(const theme of ['light','dark']){
    await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);
    const surface=page.locator('[class*="_authCard"]');
    expect(await surface.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(theme==='light'?'rgb(242, 243, 244)':'rgb(23, 25, 29)');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  }
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  await page.keyboard.press('Tab');await page.getByRole('link',{name:'Saltar al contenido'}).focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
  expect(await page.getByRole('button',{name:'Iniciar sesión',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
});

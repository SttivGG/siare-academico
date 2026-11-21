import ts from '../../frontend/node_modules/typescript/lib/typescript.js';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('frontend');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)]);
const source=walk(path.join(root,'src')), tests=walk(path.join(root,'tests'));
const text=new Map([...source,...tests].map(p=>[p,readFileSync(p,'utf8')]));
const inbound=new Map(source.map(p=>[p,[]])),edges=[];const packages=new Set();
for(const [file,body]of text){
 const sf=ts.createSourceFile(file,body,ts.ScriptTarget.Latest,true);
 function visit(node){
  let value,kind;
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){value=node.moduleSpecifier?.text;kind='static';}
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(sf)==='require')){value=node.arguments[0]?.text;kind='dynamic';}
  if(value){
   if(value.startsWith('.')){
    const stem=path.resolve(path.dirname(file),value),target=[stem,...['.ts','.tsx','.css','.json','/index.ts','/index.tsx'].map(s=>stem+s)].find(p=>existsSync(p));
    edges.push({from:path.relative(root,file).replaceAll('\\','/'),specifier:value,kind,target:target?path.relative(root,target).replaceAll('\\','/'):null});
    if(inbound.has(target))inbound.get(target).push(path.relative(root,file).replaceAll('\\','/'));
   }else{packages.add(value.startsWith('@')?value.split('/').slice(0,2).join('/'):value.split('/')[0]);}
  }
  ts.forEachChild(node,visit);
 }visit(sf);
}
const unconsumed=source.filter(p=>!inbound.get(p).length&&!p.includes(path.sep+'app'+path.sep)).map(p=>path.relative(root,p).replaceAll('\\','/'));
const assets=walk(path.join(root,'public')).map(file=>{
 const route='/'+path.relative(path.join(root,'public'),file).replaceAll('\\','/'),name=path.basename(file);
 const consumers=[...text].filter(([p,s])=>s.includes(route)||s.includes(name)).map(([p])=>path.relative(root,p).replaceAll('\\','/'));
 return {path:'public'+route,consumers,review:consumers.length?'conservar: consumidor encontrado':'sin consumidor estático; conservar árbol aprobado y procedencia hasta revisión visual/funcional'};
});
const corpus=[...text.values()].join('\n');
const css=source.filter(p=>p.endsWith('.css')).map(p=>{
 const body=text.get(p),classes=[...new Set([...body.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>m[1]))];
 const other=[...text].filter(([f])=>f!==p).map(([,s])=>s).join('\n');
 return {path:path.relative(root,p).replaceAll('\\','/'),classCandidates:classes.filter(c=>!other.includes(c)),tokens:[...new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]))].filter(t=>(corpus.match(new RegExp(t+'(?![\\w-])','g'))||[]).length===1),review:'solo candidatos léxicos: variantes, media queries, clases compuestas y estado dinámico requieren revisión; no se borró CSS'};
});
const routes=source.filter(p=>path.basename(p)==='page.tsx').map(p=>'/'+path.relative(path.join(root,'src/app'),path.dirname(p)).split(path.sep).filter(s=>!/^\(.+\)$/.test(s)&&s!=='.').join('/'));
writeFileSync('docs/release/H6_FRONTEND_REVIEW.json',JSON.stringify({method:'AST TypeScript: imports estáticos, export-from e import()/require literal; convención App Router; referencias CSS/assets. Hallazgos léxicos no prueban código muerto.',sourceFiles:source.length,testFiles:tests.length,routes,packages:[...packages].sort(),filesWithoutInboundImport:unconsumed,assets,css,edges},null,2)+'\n');
console.log(JSON.stringify({sources:source.length,tests:tests.length,routes:routes.length,unconsumed,assetsWithoutStaticConsumer:assets.filter(a=>!a.consumers.length),cssCandidates:css.map(c=>({path:c.path,classes:c.classCandidates,tokens:c.tokens})),packages:[...packages].sort()},null,2));

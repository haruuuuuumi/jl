import {readdir,readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBaseline} from '../catalog/source.mjs';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'..'),out=resolve(here,'build');
await rm(out,{recursive:true,force:true});await mkdir(resolve(out,'assets'),{recursive:true});
const allowed=new Set(['.html','.js','.css','.png','.jpg','.webp','.svg','.ttf','.txt']);
const excluded=new Set(['catalog.js','media-catalog.js','collection-catalog.js']);let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const source=resolve(dir,entry.name);if(entry.isDirectory()){await walk(source);continue;}if(!allowed.has(extname(source))||excluded.has(entry.name))continue;
 const name=relative(resolve(root,'public'),source),target=resolve(out,'assets',name);await mkdir(resolve(target,'..'),{recursive:true});
 if(name==='admin.html'||name==='admin.js'){
  let content=await readFile(source,'utf8');content=content.replaceAll('Continue with ChatGPT','Continue with Cloudflare Access').replaceAll('ChatGPT account','Cloudflare Access account');await writeFile(target,content);
 }else await copyFile(source,target);count++;
}}
await walk(resolve(root,'public'));
const baseline=await readBaseline(root);await writeFile(resolve(out,'catalog.mjs'),'export const baseline='+JSON.stringify(baseline)+';\n');
console.log(`Cloudflare build: ${baseline.length} baseline cards, ${count} private static assets; original Sites build unchanged.`);

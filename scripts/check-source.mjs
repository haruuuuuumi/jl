import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),pages=['index.html','about.html','updates.html','moments.html','cupids.html'];
const files=(await readdir(new URL('public/',root))).filter(name=>name.endsWith('.js'));
for(const file of files){const r=spawnSync(process.execPath,['--check',new URL('public/'+file,root).pathname],{encoding:'utf8'});if(r.status!==0)throw Error(file+': '+r.stderr);}
for(const page of pages){const html=await readFile(new URL('public/'+page,root),'utf8');for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\/[^"#?]+)(?:\?[^"]*)?"[^>]*>/g)){if(match[1].startsWith('//'))continue;const path=match[1].slice(1);if(path.startsWith('assets/optimized/'))await access(new URL('cloudflare/build/assets/'+path,root));else await access(new URL('public/'+path,root));}}
console.log('Public JavaScript syntax and page asset references passed.');

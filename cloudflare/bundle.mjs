import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('.',import.meta.url));await mkdir(new URL('.wrangler/',import.meta.url),{recursive:true});
const config={name:'jeolee-cupids-build-check',main:fileURLToPath(new URL('index.mjs',import.meta.url)),compatibility_date:'2026-11-21',workers_dev:false,preview_urls:false,assets:{directory:fileURLToPath(new URL('build/assets/',import.meta.url)),binding:'ASSETS',run_worker_first:true,html_handling:'none',not_found_handling:'none'}};
const path=new URL('.wrangler/build-check.json',import.meta.url);await writeFile(path,JSON.stringify(config,null,2));
const result=spawnSync(process.execPath,[root+'node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config',fileURLToPath(path),'--outdir',root+'build/worker'],{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});process.exit(result.status??1);

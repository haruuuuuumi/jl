import {readFile,access} from 'node:fs/promises';
let config;try{config=JSON.parse(await readFile(new URL('wrangler.local.json',import.meta.url),'utf8'));}catch{throw new Error('Run configure.mjs with the database ID returned by your Cloudflare account first.');}
if(!config.d1_databases?.[0]?.database_id||config.assets?.run_worker_first!==true||config.workers_dev!==false||config.preview_urls!==false)throw new Error('Cloudflare deployment configuration is incomplete.');
await access(new URL('build/catalog.mjs',import.meta.url));await access(new URL('build/assets/index.html',import.meta.url));console.log('Cloudflare configuration and build ready. Public browsing is enabled; admin requires the admin password and session secrets.');

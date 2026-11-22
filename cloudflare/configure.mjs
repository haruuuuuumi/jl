import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('wrangler.template.json',import.meta.url),'utf8'));
const args=process.argv.slice(2);let databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID||config.d1_databases[0].database_id;
if(args.length){if(args.length!==2||args[0]!=='--database-id')throw new Error('Use --database-id <Cloudflare UUID>.');databaseId=args[1];}
if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId||''))throw new Error('Use the exact database ID returned by Cloudflare.');
config.d1_databases[0].database_id=databaseId;
await writeFile(new URL('wrangler.local.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('Cloudflare configuration ready. Public site; admin uses the ADMIN_PASSWORD runtime secret.');

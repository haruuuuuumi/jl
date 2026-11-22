import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('wrangler.template.json',import.meta.url),'utf8'));
const args=process.argv.slice(2),values={'--database-id':process.env.CLOUDFLARE_D1_DATABASE_ID||config.d1_databases[0].database_id,'--team-domain':process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN||config.vars.ACCESS_TEAM_DOMAIN,'--audience':process.env.CLOUDFLARE_ACCESS_AUD||config.vars.ACCESS_AUD};for(let i=0;i<args.length;i+=2){if(!['--database-id','--team-domain','--audience'].includes(args[i])||!args[i+1])throw new Error('Use --database-id <Cloudflare UUID> --team-domain <team.cloudflareaccess.com> --audience <Access AUD>.');values[args[i]]=args[i+1];}
if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values['--database-id']||''))throw new Error('Use the exact database ID returned by Cloudflare.');
if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(values['--team-domain']||''))throw new Error('Use the team hostname from Cloudflare Access.');
if(!/^[0-9a-f]{64}$/i.test(values['--audience']||''))throw new Error('Use the exact Application Audience tag returned by Cloudflare Access.');
config.d1_databases[0].database_id=values['--database-id'];config.vars.ACCESS_TEAM_DOMAIN=values['--team-domain'];config.vars.ACCESS_AUD=values['--audience'];
await writeFile(new URL('wrangler.local.json',import.meta.url),JSON.stringify(config,null,2)+'\n');console.log('Wrote local Cloudflare configuration. Set the two admin secrets in Cloudflare before deploying.');

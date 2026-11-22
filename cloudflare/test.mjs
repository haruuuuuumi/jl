import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {createApp} from './index.mjs';
import {baseline} from './build/catalog.mjs';
import {localD1} from '../scripts/local-d1.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test-signing-key';const keys=createLocalJWKSet({keys:[jwk]});
const app=createApp({resolveKeySet:()=>keys}),origin='https://jeoleecupids.com',baseEnv={SITE_ORIGIN:origin,ACCESS_TEAM_DOMAIN:'test-only.cloudflareaccess.com',ACCESS_AUD:'test-audience',ADMIN_OWNER_EMAIL:'owner@test.invalid',ADMIN_AUTH_SECRET:'test-only-independent-cloudflare-pepper'};
async function jwt(overrides={},signingKey=privateKey){return new SignJWT({email:'owner@test.invalid',...overrides}).setProtectedHeader({alg:'RS256',kid:'test-signing-key'}).setIssuer('https://test-only.cloudflareaccess.com').setAudience('test-audience').setSubject('owner-test-sub').setIssuedAt().setExpirationTime('5m').sign(signingKey);}
function req(path='/',token,options={}){const headers=new Headers(options.headers);if(token)headers.set('cf-access-jwt-assertion',token);return new Request(origin+path,{...options,headers});}
const context={waitUntil(){}};
test('missing configuration and forged platform headers cannot expose private assets or APIs',async()=>{
 let assetCalls=0;const env={...baseEnv,ASSETS:{fetch(){assetCalls++;return new Response('private image');}}};
 for(const path of ['/','/assets/together.png','/modern.css','/api/catalog','/api/admin/session']){
  const response=await app.fetch(req(path,null,{headers:{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':baseEnv.ADMIN_OWNER_EMAIL}}),env,context);assert.equal(response.status,403);
 }assert.equal(assetCalls,0);assert.equal((await app.fetch(req('/',await jwt()),{...env,ACCESS_AUD:''},context)).status,503);
});
test('signature, issuer, audience, expiry and exact owner checks reject invalid Access assertions',async()=>{
 const other=await generateKeyPair('RS256');const invalid=[await jwt({email:'visitor@test.invalid'}),await jwt({},other.privateKey),'not-a-jwt'];
 invalid.push(await new SignJWT({email:baseEnv.ADMIN_OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://evil.invalid').setAudience('test-audience').setSubject('owner').setIssuedAt().setExpirationTime('5m').sign(privateKey));
 invalid.push(await new SignJWT({email:baseEnv.ADMIN_OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://test-only.cloudflareaccess.com').setAudience('wrong-audience').setSubject('owner').setIssuedAt().setExpirationTime('5m').sign(privateKey));
 invalid.push(await new SignJWT({email:baseEnv.ADMIN_OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://test-only.cloudflareaccess.com').setAudience('test-audience').setSubject('owner').setIssuedAt().setExpirationTime(1).sign(privateKey));
 for(const token of invalid)assert.equal((await app.fetch(req('/',token),baseEnv,context)).status,403);
});
test('owner assets are routed behind verification and hostname checks, with private browser caching',async()=>{
 const token=await jwt();let lastRequest;const env={...baseEnv,ASSETS:{async fetch(r){lastRequest=r;return new Response('real asset',{headers:{'content-type':'text/html'}});}}};
 assert.equal((await app.fetch(req('/cupids',token),env,context)).status,200);assert.equal(new URL(lastRequest.url).pathname,'/cupids.html');assert.equal(lastRequest.headers.get('oai-authenticated-user-id'),'cloudflare-access:owner-test-sub');
 const response=await app.fetch(req('/assets/together.png',token),env,context);assert.equal(response.headers.get('cache-control'),'private, max-age=86400');
 assert.equal((await app.fetch(new Request('https://other.invalid/',{headers:{'cf-access-jwt-assertion':token}}),env,context)).status,403);
 assert.equal((await app.fetch(req('/admin/',token),env,context)).status,308);assert.equal((await app.fetch(req('/cupids',token,{method:'POST'}),env,context)).status,405);
 assert.equal((await app.fetch(req('/signin-with-chatgpt',token),env,context)).headers.get('location'),origin+'/admin');
});
test('catalog overrides retain edits and deletions; new-host admin setup remains owner-only',async()=>{
 const DB=await localD1();try{
  const insert=DB.sqlite.prepare('INSERT INTO catalog_entries (id,source_key,media_key,title,item_json,category_ids,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  baseline.slice(0,4).forEach((item,index)=>insert.run(item.id,'fixture:'+item.id,null,index===3?'Fixture edited title':item.title,JSON.stringify(item),JSON.stringify(['just-jeolee']),index<3?'deleted':'published',1,1,1));
  const env={...baseEnv,DB},token=await jwt();const response=await app.fetch(req('/api/catalog',token),env,context);assert.equal(response.status,200);const data=await response.json();assert.equal(data.items.length,117);assert.equal(data.categories.length,4);
  const session=await app.fetch(req('/api/admin/session',token,{headers:{'oai-authenticated-user-email':'forged@test.invalid'}}),env,context);assert.deepEqual(await session.json(),{authenticated:false,requiresOwnerSignIn:false,setupRequired:true});
  const setup=await app.fetch(req('/api/admin/setup',token,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:'test-only-cloudflare-password-123'})}),env,context);assert.equal(setup.status,201);const cookie=setup.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));
  const admin=await app.fetch(req('/api/admin/catalog',token,{headers:{cookie:cookie.split(';')[0]}}),env,context);assert.equal(admin.status,200);assert.equal((await admin.json()).items.length,120);
  const schema=DB.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(x=>x.name);for(const table of ['admin_config','admin_sessions','catalog_categories','catalog_entries','request_limits','wiki_pages','wiki_proposals'])assert.ok(schema.includes(table));
 }finally{DB.close();}
});
test('deployment config cannot bypass the private Worker and build excludes internal catalogs or provenance',async()=>{
 const config=JSON.parse(await readFile(new URL('wrangler.template.json',import.meta.url),'utf8'));assert.equal(config.assets.run_worker_first,true);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.routes[0].pattern,'jeoleecupids.com');
 await assert.rejects(access(new URL('build/assets/catalog.js',import.meta.url)));await assert.rejects(access(new URL('build/assets/assets/together.png.json',import.meta.url)));
 assert.ok((await readFile(new URL('build/assets/modern.css',import.meta.url),'utf8')).includes('--pink:#f576b5'));await access(new URL('build/assets/assets/pathway-extreme-OFL.txt',import.meta.url));
});

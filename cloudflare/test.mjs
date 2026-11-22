import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createApp} from './index.mjs';
import {baseline} from './build/catalog.mjs';
import {localD1} from '../scripts/local-d1.mjs';
const app=createApp(),origin='https://jeoleecupids.com',baseEnv={SITE_ORIGIN:origin,ADMIN_PASSWORD:'test-only-admin-password-123',ADMIN_AUTH_SECRET:'test-only-independent-cloudflare-pepper'};
function req(path='/',unused,options={}){return new Request(origin+path,options);}
const context={waitUntil(){}};
async function login(env,password=baseEnv.ADMIN_PASSWORD,ip='203.0.113.10'){
 const response=await app.fetch(req('/api/admin/login',null,{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({password})}),env,context);assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
const assets={async fetch(r){return new Response('asset:'+new URL(r.url).pathname);}};
test('public pages need no account or admin configuration and spoofed identity headers are stripped',async()=>{
 let lastRequest;const env={SITE_ORIGIN:origin,ASSETS:{fetch(r){lastRequest=r;return new Response('public asset');}}};
 for(const path of ['/','/cupids','/assets/together.png','/modern.css']){
  assert.equal((await app.fetch(req(path,null,{headers:{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'forged@test.invalid'}}),env,context)).status,200);assert.equal(lastRequest.headers.get('oai-authenticated-user-id'),null);assert.equal(lastRequest.headers.get('oai-authenticated-user-email'),null);
 }
 assert.equal((await app.fetch(req('/assets/together.png'),env,context)).headers.get('cache-control'),'public, max-age=86400');
 assert.equal((await app.fetch(new Request('https://other.invalid/'),env,context)).status,403);
 assert.equal((await app.fetch(req('/cupids',null,{method:'POST'}),env,context)).status,405);
});
test('admin dashboard HTML and scripts stay hidden until the password session is valid',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB,ASSETS:assets};
 for(const path of ['/admin','/admin.html']){const response=await app.fetch(req(path),env,context);assert.equal(response.status,200);assert.equal(await response.text(),'asset:/admin-login.html');assert.equal(response.headers.get('cache-control'),'no-store');}
 for(const path of ['/admin.js','/admin-wiki.js','/admin.css','/api/admin/catalog','/api/admin/setup','/api/admin/wiki'])assert.equal((await app.fetch(req(path,null,{headers:{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'forged@test.invalid'}}),env,context)).status,401);
 const cookie=await login(env);const response=await app.fetch(req('/admin',null,{headers:{cookie}}),env,context);assert.equal(await response.text(),'asset:/admin.html');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await app.fetch(req('/admin.js',null,{headers:{cookie}}),env,context)).status,200);
 assert.equal((await app.fetch(req('/admin/',null,{headers:{cookie}}),env,context)).status,308);
 }finally{DB.close();}
});
test('encoded aliases cannot expose admin HTML or bypass API authentication',async()=>{
 const env={...baseEnv,ASSETS:assets};
 for(const path of ['/%61dmin.html','/admin%2ehtml','//admin.html']){const response=await app.fetch(req(path),env,context);assert.equal(response.status,308);const target=await app.fetch(new Request(response.headers.get('location')),env,context);assert.equal(await target.text(),'asset:/admin-login.html');}
 const response=await app.fetch(req('/api/%61dmin/catalog'),env,context);assert.equal(response.status,308);assert.equal((await app.fetch(new Request(response.headers.get('location')),env,context)).status,401);
 assert.equal((await app.fetch(req('/%ZZ'),env,context)).status,400);
});
test('password-only login uses protected cookies, rejects forged sessions, and supports logout',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB};
 const missing=await app.fetch(req('/api/admin/login',null,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:'anything'})}),{...env,ADMIN_PASSWORD:''},context);assert.equal(missing.status,503);
 const crossOrigin=await app.fetch(req('/api/admin/login',null,{method:'POST',headers:{origin:'https://other.invalid','content-type':'application/json'},body:JSON.stringify({password:baseEnv.ADMIN_PASSWORD})}),env,context);assert.equal(crossOrigin.status,403);
 const response=await app.fetch(req('/api/admin/login',null,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:baseEnv.ADMIN_PASSWORD})}),env,context);assert.equal(response.status,200);const setCookie=response.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(setCookie.includes(flag));const cookie=setCookie.split(';')[0];
 assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie:'jeolee_admin='+'a'.repeat(64)}}),env,context)).status,401);
 assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie}}),env,context)).status,200);
 const session=await (await app.fetch(req('/api/admin/session',null,{headers:{cookie}}),env,context)).json();assert.equal(session.authenticated,true);assert.equal(session.requiresOwnerSignIn,false);assert.equal(session.setupRequired,false);
 const stored=DB.sqlite.prepare('SELECT token_hash,owner_id FROM admin_sessions').get();assert.ok(!JSON.stringify(stored).includes(baseEnv.ADMIN_PASSWORD));assert.notEqual(stored.token_hash,cookie.split('=')[1]);
 assert.equal((await app.fetch(req('/api/admin/setup',null,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify({password:'attacker-password-123'})}),env,context)).status,405);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_config').get().n,0);
 assert.equal((await app.fetch(req('/api/admin/logout',null,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:'{}'}),env,context)).status,200);assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie}}),env,context)).status,401);
 const expiredCookie=await login(env);DB.sqlite.prepare('UPDATE admin_sessions SET expires_at=0').run();assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie:expiredCookie}}),env,context)).status,401);
 }finally{DB.close();}
});
test('changing the password secret invalidates existing admin sessions',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB},cookie=await login(env);const changed={...env,ADMIN_PASSWORD:'a-new-test-only-password-123'};
 assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie}}),changed,context)).status,401);const updatedCookie=await login(changed,changed.ADMIN_PASSWORD);assert.equal((await app.fetch(req('/api/admin/catalog',null,{headers:{cookie:updatedCookie}}),changed,context)).status,200);
 }finally{DB.close();}
});
test('incorrect password attempts are limited per IP',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB};for(let i=0;i<6;i++){const response=await app.fetch(req('/api/admin/login',null,{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'203.0.113.5'},body:JSON.stringify({password:'wrong-password'})}),env,context);assert.equal(response.status,i===5?429:401);}await login(env,baseEnv.ADMIN_PASSWORD,'203.0.113.6');}finally{DB.close();}
});
test('public catalog retains title edits and deletions from database overrides',async()=>{
 const DB=await localD1();try{
 const insert=DB.sqlite.prepare('INSERT INTO catalog_entries (id,source_key,media_key,title,item_json,category_ids,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');baseline.slice(0,4).forEach((item,index)=>insert.run(item.id,'fixture:'+item.id,null,index===3?'Fixture edited title':item.title,JSON.stringify(item),'["just-jeolee"]',index<3?'deleted':'published',1,1,1));
 const response=await app.fetch(req('/api/catalog'),{...baseEnv,DB},context);assert.equal(response.status,200);const data=await response.json();assert.equal(data.items.length,117);assert.equal(data.categories.length,4);assert.ok(data.items.some(i=>i.title==='Fixture edited title'));
 }finally{DB.close();}
});
test('static assets cannot bypass admin checks and internal catalogs stay excluded',async()=>{
 const config=JSON.parse(await readFile(new URL('wrangler.template.json',import.meta.url),'utf8'));assert.equal(config.assets.run_worker_first,true);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.vars.ADMIN_AUTH_MODE,'password');
 await assert.rejects(access(new URL('build/assets/catalog.js',import.meta.url)));await assert.rejects(access(new URL('build/assets/assets/together.png.json',import.meta.url)));await access(new URL('build/assets/admin-login.html',import.meta.url));
});
const proposal={title:'A Cupid contribution',summary:'A sourced memory from Jeolee’s shared moments.',topic:'Moments',body:'A fan-contributed account of a Jeolee moment, with an original source for the owner to review before publishing.',sources:['https://x.com/abby88308703/status/2124129578931356055'],contributor:'A Cupid',changeNote:'New page'};
const post=(body,extra={})=>({method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(body)});
test('anonymous Cupids contributions stay pending and enforce same-origin requests and rate limits',async()=>{
 const DB=await localD1();try{
  const env={...baseEnv,DB};
  assert.equal((await app.fetch(req('/api/wiki/pages'),env,context)).status,200);
  assert.equal((await app.fetch(req('/api/wiki/proposals',null,post(proposal,{origin:'https://other.invalid'})),env,context)).status,403);
  for(let i=0;i<5;i++){
   const response=await app.fetch(req('/api/wiki/proposals',null,post({...proposal,title:proposal.title+' '+i},{'cf-connecting-ip':'203.0.113.1','oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':baseEnv.ADMIN_OWNER_EMAIL})),env,context);assert.equal(response.status,201);assert.equal((await response.json()).status,'pending');
  }
  assert.equal((await app.fetch(req('/api/wiki/proposals',null,post({...proposal,title:'Over the limit'},{'cf-connecting-ip':'203.0.113.1'})),env,context)).status,429);
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM wiki_proposals WHERE status='pending'").get().n,5);
  const pages=await (await app.fetch(req('/api/wiki/pages'),env,context)).json();assert.equal(pages.pages.length,0);
  assert.equal((await app.fetch(req('/api/admin/wiki'),env,context)).status,401);
  const pending=DB.sqlite.prepare('SELECT id FROM wiki_proposals ORDER BY created_at,id LIMIT 1').get();
  assert.equal((await app.fetch(req('/api/admin/wiki/proposals/'+pending.id,null,{...post({}),method:'PATCH'}),env,context)).status,401);
  const cookie=await login(env);const row=DB.sqlite.prepare('SELECT title FROM wiki_proposals WHERE id=?').get(pending.id);
  const approval=await app.fetch(req('/api/admin/wiki/proposals/'+pending.id,null,{...post({...proposal,title:row.title,action:'approve',revision:1}),method:'PATCH',headers:{origin,'content-type':'application/json',cookie}}),env,context);assert.equal(approval.status,200);
  assert.equal((await (await app.fetch(req('/api/wiki/pages'),env,context)).json()).pages.length,1);
 }finally{DB.close();}
});
test('anonymous video submissions are checked and remain absent from the published catalog until approval',async()=>{
 const DB=await localD1(),originalFetch=globalThis.fetch;try{
  globalThis.fetch=async input=>{assert.equal(new URL(input).hostname,'cdn.syndication.twimg.com');return Response.json({__typename:'Tweet',user:{screen_name:'test_cupid',name:'Test Cupid'},mediaDetails:[{type:'video',media_url_https:'https://pbs.twimg.com/amplify_video_thumb/9999999999999999999/img/test.jpg',video_info:{duration_millis:1000,variants:[{content_type:'video/mp4',url:'https://video.twimg.com/test.mp4',bitrate:100000}]}}]});};
  const env={...baseEnv,DB};const response=await app.fetch(req('/api/submissions',null,post({title:'A submitted clip',url:'https://x.com/test_cupid/status/9999999999999999999',categoryId:'fan-edits'})),env,context);assert.equal(response.status,201);assert.equal((await response.json()).status,'pending');
  assert.equal(DB.sqlite.prepare("SELECT COUNT(*) AS n FROM catalog_entries WHERE status='pending'").get().n,1);
  assert.equal((await (await app.fetch(req('/api/catalog'),env,context)).json()).items.length,baseline.length);
 }finally{globalThis.fetch=originalFetch;DB.close();}
});

function stubSubmissionVideos(){
 const original=globalThis.fetch;
 globalThis.fetch=async input=>{const id=new URL(input).searchParams.get('id');return Response.json({__typename:'Tweet',user:{screen_name:'test_cupid',name:'Test Cupid'},mediaDetails:[{type:'video',media_url_https:'https://pbs.twimg.com/amplify_video_thumb/'+id+'/img/test.jpg',video_info:{duration_millis:1000,variants:[{content_type:'video/mp4',url:'https://video.twimg.com/'+id+'.mp4',bitrate:100000}]}}]});};
 return ()=>{globalThis.fetch=original;};
}
async function suggestClip(env,id,name){
 const response=await app.fetch(req('/api/submissions',null,post({title:'A suggested clip',url:'https://x.com/test_cupid/status/'+id,suggestedCategory:name})),env,context);assert.equal(response.status,201);return (await response.json()).id;
}
async function editClip(env,cookie,id,body){return app.fetch(req('/api/admin/clips/'+id,null,{method:'PATCH',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(body)}),env,context);}
test('new category suggestions stay private until the admin approves and publishes them with a clip',async()=>{
 const DB=await localD1(),restore=stubSubmissionVideos();try{
  const env={...baseEnv,DB},id=await suggestClip(env,'9999999999999999001','Bandana days');
  const before=await (await app.fetch(req('/api/catalog'),env,context)).json();assert.equal(before.categories.length,4);assert.equal(before.items.length,baseline.length);
  assert.equal((await editClip(env,'',id,{revision:1,status:'published',newCategoryName:'Bandana days',categoryIds:[]})).status,401);
  const cookie=await login(env),review=await (await app.fetch(req('/api/admin/catalog',null,{headers:{cookie}}),env,context)).json();assert.equal(review.items.find(i=>i.id===id).suggestedCategory,'Bandana days');
  assert.equal((await editClip(env,cookie,id,{revision:1,status:'published'})).status,400);
  assert.equal((await editClip(env,cookie,id,{revision:1,categoryIds:[],suggestedCategory:'Bandana moments'})).status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,0);
  assert.equal((await editClip(env,cookie,id,{revision:2,status:'published',categoryIds:[],newCategoryName:'Bandana moments'})).status,200);
  const published=await (await app.fetch(req('/api/catalog'),env,context)).json(),item=published.items.find(i=>i.id===id);assert.equal(published.categories.length,5);assert.equal(item.category,'Bandana moments');assert.equal(item.suggestedCategory,undefined);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,1);
  assert.equal((await editClip(env,cookie,id,{revision:2,status:'published',categoryIds:[],newCategoryName:'A stale suggestion'})).status,409);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,1);
 }finally{restore();DB.close();}
});
test('admin can reject the suggested category and publish the clip in an existing category',async()=>{
 const DB=await localD1(),restore=stubSubmissionVideos();try{
  const env={...baseEnv,DB},id=await suggestClip(env,'9999999999999999002','Unused suggestion'),cookie=await login(env);
  assert.equal((await editClip(env,cookie,id,{revision:1,status:'published',categoryIds:['fan-edits']})).status,200);
  const data=await (await app.fetch(req('/api/catalog'),env,context)).json();assert.equal(data.categories.length,4);assert.equal(data.items.find(i=>i.id===id).category,'Fan edits');assert.equal(data.items.find(i=>i.id===id).suggestedCategory,undefined);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,0);
 }finally{restore();DB.close();}
});
test('matching category suggestions reuse the category already approved by the admin',async()=>{
 const DB=await localD1(),restore=stubSubmissionVideos();try{
  const env={...baseEnv,DB},first=await suggestClip(env,'9999999999999999003','Cupid favorites'),second=await suggestClip(env,'9999999999999999004','cupid favorites'),cookie=await login(env);
  for(const [id,name] of [[first,'Cupid favorites'],[second,'CUPID FAVORITES']])assert.equal((await editClip(env,cookie,id,{revision:1,status:'published',categoryIds:[],newCategoryName:name})).status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,1);
  const data=await (await app.fetch(req('/api/catalog'),env,context)).json();assert.equal(data.items.find(i=>i.id===first).category,'Cupid favorites');assert.equal(data.items.find(i=>i.id===second).category,'Cupid favorites');
 }finally{restore();DB.close();}
});
test('a concurrent review cannot leave a public category behind without the approved clip',async()=>{
 const DB=await localD1(),restore=stubSubmissionVideos();try{
  const env={...baseEnv,DB},id=await suggestClip(env,'9999999999999999005','Race-safe suggestion'),cookie=await login(env),batch=DB.batch;
  DB.batch=async statements=>{DB.sqlite.prepare('UPDATE catalog_entries SET revision=revision+1 WHERE id=?').run(id);return batch(statements);};
  assert.equal((await editClip(env,cookie,id,{revision:1,status:'published',categoryIds:[],newCategoryName:'Race-safe suggestion'})).status,409);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,0);assert.equal(DB.sqlite.prepare('SELECT status FROM catalog_entries WHERE id=?').get(id).status,'pending');
 }finally{restore();DB.close();}
});
test('invalid category suggestions are rejected before video metadata is requested',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB};
 for(const suggestedCategory of ['', 'x'.repeat(41),'fan edits']){const response=await app.fetch(req('/api/submissions',null,post({title:'Invalid suggestion',url:'https://x.com/test_cupid/status/9999999999999999006',suggestedCategory})),env,context);assert.equal(response.status,400);}
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_categories').get().n,0);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM catalog_entries').get().n,0);
 }finally{DB.close();}
});

test('About Jeolee has its own public page and the homepage links to it',async()=>{
 const env={SITE_ORIGIN:origin,ASSETS:assets};const response=await app.fetch(req('/about'),env,context);assert.equal(response.status,200);assert.equal(await response.text(),'asset:/about.html');
 const redirect=await app.fetch(req('/about/'),env,context);assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/about');
 const about=await readFile(new URL('../public/about.html',import.meta.url),'utf8'),home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(about.includes('id="jeo-profile"'));assert.ok(about.includes('id="gehlee-profile"'));assert.ok(about.includes('id="fandoms"'));assert.ok(home.includes('href="/about"'));assert.ok(!home.includes('id="jeo-profile"'));assert.ok(!about.includes('src="app.js'));
});

test('free fandom feeds refresh at noon and midnight Philippine time without an API token',async()=>{
 const source=await readFile(new URL('../public/fandom-feeds.js',import.meta.url),'utf8');const clock=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.deepEqual(clock.FANDOM_ACCOUNTS.map(a=>a.handle),['jeoleenation','official_jeolee','withjeolee']);
 const beforeNoon=Date.parse('2026-11-22T03:59:59Z'),noon=Date.parse('2026-11-22T04:00:00Z'),midnight=Date.parse('2026-11-22T16:00:00Z');
 assert.equal(clock.nextFeedRefreshAt(beforeNoon),noon);assert.equal(clock.nextFeedRefreshAt(noon),midnight);assert.equal(clock.feedRefreshWindow(beforeNoon)+1,clock.feedRefreshWindow(noon));assert.equal(clock.feedRefreshWindow(noon)+1,clock.feedRefreshWindow(midnight));
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(home.includes('id="fandom-feed-tabs"'));assert.ok(home.includes('id="fandom-feed-source"'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createApp} from './index.mjs';
import {baseline} from './build/catalog.mjs';
import {localD1} from '../scripts/local-d1.mjs';
import {FANDOM_ACCOUNTS,profilePostIds,cardFromPost,collectFandomUpdates,syncFandomUpdates,nextFandomCheck} from '../worker/fandom-updates.mjs';
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

test('public page footers contain only the requested management credit and use the JL icon',async()=>{
 for(const page of ['index.html','about.html','moments.html','updates.html','cupids.html']){const html=await readFile(new URL('../public/'+page,import.meta.url),'utf8'),footer=html.match(/<footer[\s\S]*?<\/footer>/)?.[0];assert.ok(footer.includes('Managed by Jeolee – Amats GDM'));assert.ok(!footer.includes('Netflix'));assert.ok(!footer.includes('/admin'));assert.ok(html.includes('favicon.svg?v=jl-2'));}
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(!home.includes('for the plot. for the butterflies.'));assert.ok(!home.includes('Clips stay with their original creators on X.'));
 const icon=await readFile(new URL('../public/assets/favicon.svg',import.meta.url),'utf8');assert.ok(icon.includes('aria-label="JL"'));
});


const fixturePosts=[
 {id:'1000000000000000001',handle:'jeoleenation',created_at:'2026-11-01T00:00:00Z',text:'An older pinned story'},
 {id:'1000000000000000002',handle:'jeoleenation',created_at:'2026-11-22T03:00:00Z',text:'Today from Nation &amp; Cupids'},
 {id:'1000000000000000003',handle:'official_jeolee',created_at:'2026-11-22T02:00:00Z',text:'Official fanbase update'},
 {id:'1000000000000000004',handle:'withjeolee',created_at:'2026-11-22T01:00:00Z',text:'With Jeolee update'},
 {id:'1000000000000000005',handle:'withjeolee',created_at:'2026-11-20T00:00:00Z',text:'Earlier update'}
];
function fixtureSource(calls=[]){return async input=>{
 const url=new URL(input);calls.push(url.href);
 if(url.hostname==='x.com'){const handle=url.pathname.slice(1);return new Response(fixturePosts.filter(p=>p.handle===handle).map(p=>'<a href="/'+p.handle+'/status/'+p.id+'">Post</a>').join(''));}
 assert.equal(url.hostname,'cdn.syndication.twimg.com');const post=fixturePosts.find(p=>p.id===url.searchParams.get('id'));assert.ok(post);
 return Response.json({__typename:'Tweet',id_str:post.id,user:{screen_name:post.handle},text:post.text,created_at:post.created_at,mediaDetails:[{media_url_https:'https://pbs.twimg.com/media/test.jpg'}]});
};}
test('shared reader verifies approved authors and dates, sorts past pinned posts and saves only the latest three',async()=>{
 const calls=[],result=await collectFandomUpdates({fetchImpl:fixtureSource(calls),bootstrapPosts:[]});
 assert.deepEqual(FANDOM_ACCOUNTS.map(a=>a.handle),['jeoleenation','official_jeolee','withjeolee']);assert.equal(result.errors.length,0);assert.equal(result.profilesRead,3);
 assert.deepEqual(result.posts.map(p=>p.postId),fixturePosts.slice(1,4).map(p=>p.id));assert.equal(result.posts[0].title,'Today from Nation & Cupids');assert.equal(result.posts[0].source,'Jeolee Nation · @jeoleenation');assert.equal(result.posts[0].imageFromPost,true);
 const again=await collectFandomUpdates({fetchImpl:fixtureSource(),knownPosts:result.posts,bootstrapPosts:[]});assert.equal(again.posts.length,0);
 assert.deepEqual(profilePostIds('<a href="/unapproved/status/1000000000000000002"></a><a href="https://x.com/jeoleenation/status/1000000000000000002?s=20"></a>','jeoleenation'),['1000000000000000002']);
 const data={__typename:'Tweet',id_str:fixturePosts[1].id,user:{screen_name:'other'},text:'Wrong author',created_at:fixturePosts[1].created_at};assert.equal(cardFromPost(data,data.id_str,FANDOM_ACCOUNTS[0]),null);data.user.screen_name='jeoleenation';data.created_at='invalid';assert.equal(cardFromPost(data,data.id_str,FANDOM_ACCOUNTS[0]),null);
});
test('source failures preserve saved cards, record the failure, and respect backoff',async()=>{
 const DB=await localD1();try{
  const env={...baseEnv,DB},now=Date.parse('2026-11-22T03:59:00Z');
  assert.equal((await syncFandomUpdates(env,{fetchImpl:fixtureSource(),now,bootstrapPosts:[]})).imported,3);
  let requests=0;const blocked=async()=>{requests++;return new Response('Unavailable',{status:403});};
  const failed=await syncFandomUpdates(env,{fetchImpl:blocked,now:now+120000,bootstrapPosts:[]});assert.equal(failed.outcome,'unavailable');assert.equal(failed.imported,0);assert.equal(requests,3);
  const saved=await (await app.fetch(req('/api/updates'),env,context)).json();assert.equal(saved.items.length,8);assert.equal(saved.lastSuccessAt,now);assert.equal(saved.lastCheckFailed,true);
  const paused=await syncFandomUpdates(env,{fetchImpl:blocked,now:now+180000,bootstrapPosts:[]});assert.equal(paused.outcome,'skipped');assert.equal(requests,3);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM fandom_updates').get().n,8);
 }finally{DB.close();}
});
test('a rate-limited metadata source is not repeatedly requested during the same check',async()=>{
 let metadataCalls=0;const normal=fixtureSource(),now=Date.parse('2026-11-22T03:59:00Z');
 const result=await collectFandomUpdates({now,bootstrapPosts:[],fetchImpl:async input=>{if(new URL(input).hostname==='cdn.syndication.twimg.com'){metadataCalls++;return new Response('',{status:429,headers:{'retry-after':'7200'}});}return normal(input);}});
 assert.equal(result.posts.length,0);assert.equal(metadataCalls,1);assert.ok(result.retryAfter>=now+7200000);
});
test('only the password-protected same-origin admin can manually run the reader',async()=>{
 const DB=await localD1();try{const calls=[],readerApp=createApp({fetchFandomSource:fixtureSource(calls),bootstrapPosts:[]}),env={...baseEnv,DB};
 assert.equal((await readerApp.fetch(req('/api/admin/updates/sync',null,post({})),env,context)).status,401);
 const cookie=await login(env);assert.equal((await readerApp.fetch(req('/api/admin/updates/sync',null,{...post({}),headers:{origin:'https://other.invalid','content-type':'application/json',cookie}}),env,context)).status,403);assert.equal(calls.length,0);
 const result=await (await readerApp.fetch(req('/api/admin/updates/sync',null,{...post({}),headers:{origin,'content-type':'application/json',cookie}}),env,context)).json();assert.equal(result.imported,3);const count=calls.length;
 const again=await (await readerApp.fetch(req('/api/admin/updates/sync',null,{...post({}),headers:{origin,'content-type':'application/json',cookie}}),env,context)).json();assert.equal(again.outcome,'recent');assert.equal(calls.length,count);
 const feed=await (await readerApp.fetch(req('/api/updates'),env,context)).json();assert.equal(feed.items.length,8);assert.equal(feed.errors,undefined);
 }finally{DB.close();}
});
test('public reads can start only one initial check and cron runs with the site closed',async()=>{
 const DB=await localD1();try{const calls=[],readerApp=createApp({fetchFandomSource:fixtureSource(calls),bootstrapPosts:[]}),env={...baseEnv,DB},work=[],ctx={waitUntil(p){work.push(p);}};
 await Promise.all([readerApp.fetch(req('/api/updates'),env,ctx),readerApp.fetch(req('/api/updates'),env,ctx)]);await Promise.all(work);assert.equal(calls.filter(url=>new URL(url).hostname==='x.com').length,3);
 await readerApp.fetch(req('/api/updates'),env,ctx);await Promise.all(work);assert.equal(calls.filter(url=>new URL(url).hostname==='x.com').length,3);
 await readerApp.scheduled({},env,ctx);assert.equal(calls.filter(url=>new URL(url).hostname==='x.com').length,6);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM fandom_updates').get().n,8);
 }finally{DB.close();}
});
test('server cron uses noon and midnight Philippine time and public updates use a saved-card carousel',async()=>{
 const beforeNoon=Date.parse('2026-11-22T03:59:59Z'),noon=Date.parse('2026-11-22T04:00:00Z'),midnight=Date.parse('2026-11-22T16:00:00Z');assert.equal(nextFandomCheck(beforeNoon),noon);assert.equal(nextFandomCheck(noon),midnight);assert.equal(nextFandomCheck(midnight),noon+86400000);
 const config=JSON.parse(await readFile(new URL('./wrangler.template.json',import.meta.url),'utf8'));assert.deepEqual(config.triggers.crons,['0 4,16 * * *']);
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(home.includes('aria-roledescription="carousel"'));assert.ok(home.includes('id="hub-next"'));assert.ok(!home.includes('fandom-feeds.js'));assert.ok(!home.includes('id="fandom-feeds"'));
});

test('an owner-supplied individual post is verified even if the profile pages cannot be read',async()=>{
 const normal=fixtureSource(),post=fixturePosts[1];
 const result=await collectFandomUpdates({bootstrapPosts:[{handle:post.handle,id:post.id}],fetchImpl:async input=>new URL(input).hostname==='x.com'?new Response('Unavailable',{status:403}):normal(input)});
 assert.equal(result.profilesRead,0);assert.equal(result.errors.length,3);assert.equal(result.posts.length,1);assert.equal(result.posts[0].postId,post.id);assert.equal(result.posts[0].createdAt,post.created_at.replace('00Z','00.000Z'));
});

test('Moments and Updates are public destinations and slash aliases redirect',async()=>{
 for(const page of ['moments','updates']){const response=await app.fetch(req('/'+page),{SITE_ORIGIN:origin,ASSETS:assets},{});assert.equal(response.status,200);assert.equal(await response.text(),'asset:/'+page+'.html');const redirect=await app.fetch(req('/'+page+'/'),{SITE_ORIGIN:origin,ASSETS:assets},{});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/'+page);}
});
test('admin can publish, edit, trash and restore sourced updates without exposing the write API',async()=>{
 const DB=await localD1();try{
  const env={...baseEnv,DB},body={title:'A sourced update',summary:'An original-source summary for the Cupids.',source:'Test Fanbase',kind:'fandom',url:'https://x.com/test/status/1000000000000000999',date:'2026-11-21',image:''};
  assert.equal((await app.fetch(req('/api/admin/updates',null,post(body)),env,{})).status,401);const cookie=await login(env),headers={origin,'content-type':'application/json',cookie};
  assert.equal((await app.fetch(req('/api/admin/updates',null,{...post(body),headers:{...headers,origin:'https://other.invalid'}}),env,{})).status,403);
  for(const invalid of [{...body,url:'javascript:alert(1)'},{...body,date:'2026-02-31'},{...body,source:''}])assert.equal((await app.fetch(req('/api/admin/updates',null,{...post(invalid),headers}),env,{})).status,400);
  const created=await app.fetch(req('/api/admin/updates',null,{...post(body),headers}),env,{});assert.equal(created.status,201);const item=(await created.json()).item;
  const patch=(value)=>app.fetch(req('/api/admin/updates/'+item.postId,null,{method:'PATCH',headers,body:JSON.stringify(value)}),env,{});
  assert.equal((await patch({...body,title:'A better title',revision:1})).status,200);assert.equal((await patch({...body,revision:1})).status,409);
  const read=()=>app.fetch(req('/api/updates?kind=fandom'),env,{}).then(r=>r.json());
  let feed=await read();assert.ok(feed.items.some(p=>p.title==='A better title'));assert.equal(feed.errors,undefined);
  assert.equal((await patch({status:'deleted',revision:2})).status,200);feed=await read();assert.ok(!feed.items.some(p=>p.postId===item.postId));
  assert.equal((await patch({status:'published',revision:3})).status,200);assert.ok((await read()).items.some(p=>p.postId===item.postId));
 }finally{DB.close();}
});
test('the approved curated stories are migrated once and remain editable in admin',async()=>{
 const DB=await localD1();try{
  const env={...baseEnv,DB},feed=await (await app.fetch(req('/api/updates'),env,{})).json();assert.equal(feed.items.length,5);assert.equal(feed.items[0].postId,'2124374963444723894');assert.ok(feed.items.every(item=>item.date.startsWith('2026-11-')));assert.equal(feed.lastSuccessAt,null);
  const coverage=await (await app.fetch(req('/api/updates?kind=coverage&q=Zack'),env,{})).json();assert.equal(coverage.items.length,1);assert.equal(coverage.items[0].date,'2026-11-04');
  const cookie=await login(env),admin=await (await app.fetch(req('/api/admin/updates',null,{headers:{cookie}}),env,{})).json();assert.equal(admin.items.length,5);assert.ok(admin.items.every(item=>item.revision===(item.postId==='2124374963444723894'?2:1)));
 }finally{DB.close();}
});

test('editing seeded illustrative stories preserves their image and caption until explicitly removed',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB},cookie=await login(env),headers={origin,'content-type':'application/json',cookie};
 const listed=await (await app.fetch(req('/api/admin/updates',null,{headers:{cookie}}),env,{})).json(),item=listed.items.find(p=>p.image&&p.image.startsWith('assets/'));assert.ok(item);
 const body={title:item.title+' revised',summary:item.summary,source:item.source,url:item.url,date:item.date,kind:item.kind,image:'',revision:item.revision};
 const endpoint='/api/admin/updates/'+item.postId;
 let response=await app.fetch(req(endpoint,null,{method:'PATCH',headers,body:JSON.stringify(body)}),env,{});assert.equal(response.status,200);let edited=(await response.json()).item;assert.equal(edited.image,item.image);assert.equal(edited.imageFromPost,false);
 response=await app.fetch(req(endpoint,null,{method:'PATCH',headers,body:JSON.stringify({...body,revision:edited.revision,removeImage:true})}),env,{});assert.equal(response.status,200);assert.equal((await response.json()).item.image,'');
 }finally{DB.close();}
});

test('explicit image removal wins over a prefilled HTTPS image field',async()=>{
 const DB=await localD1();try{const env={...baseEnv,DB},cookie=await login(env),headers={origin,'content-type':'application/json',cookie},body={title:'A story with a source image',summary:'A verified-source image accompanies this saved story.',source:'Test Publisher',kind:'coverage',url:'https://news.example.com/story',date:'2026-11-21',image:'https://pbs.twimg.com/media/source.jpg'};
 const created=await (await app.fetch(req('/api/admin/updates',null,{...post(body),headers}),env,{})).json();
 const response=await app.fetch(req('/api/admin/updates/'+created.item.postId,null,{method:'PATCH',headers,body:JSON.stringify({...body,revision:1,removeImage:true})}),env,{});assert.equal(response.status,200);const item=(await response.json()).item;assert.equal(item.image,'');assert.equal(item.imageFromPost,false);
 }finally{DB.close();}
});

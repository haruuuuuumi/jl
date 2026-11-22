import {getToken,extractVideo} from './video.mjs';
import {wikiApi} from './wiki.mjs';
const defaultCatalogCategories=[
 {id:'just-jeolee',name:'Just Jeolee',position:0},{id:'tinginan-serye',name:'Tinginan serye',position:1},{id:'their-soundtrack',name:'Their soundtrack',position:2},{id:'fan-edits',name:'Fan edits',position:3}
];
const adminCookie='jeolee_admin';
const authIterations=100000;
const utf8=new TextEncoder();
class CatalogError extends Error{constructor(status,message){super(message);this.status=status;}}
function catalogJson(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomHex=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
async function sha256(value){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(value))));}
async function catalogHmac(secret,value){const key=await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,utf8.encode(value)));}
async function passwordDigest(password,salt,secret,iterations=authIterations){
 const peppered=await catalogHmac(secret,'password:v1:'+password);
 const key=await crypto.subtle.importKey('raw',peppered,'PBKDF2',false,['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:utf8.encode(salt),iterations},key,256)));
}
function equalDigest(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
function ownerIdentity(request,env){if(env.ADMIN_AUTH_MODE==='password')return typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=12&&env.ADMIN_PASSWORD.length<=128?'password-admin':null;const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return id&&email&&env.ADMIN_OWNER_EMAIL&&email.toLowerCase()===env.ADMIN_OWNER_EMAIL.toLowerCase()?id:null;}
function requireOwner(request,env){const owner=ownerIdentity(request,env);if(!owner)throw new CatalogError(403,'Sign in with the site owner’s ChatGPT account to use admin.');return owner;}
function requireCatalogDb(env){if(!env.DB)throw new CatalogError(503,'The library database is not available right now.');return env.DB;}
function requireAuthSecret(env){if(!env.ADMIN_AUTH_SECRET)throw new CatalogError(503,'Admin setup is not available right now.');return env.ADMIN_AUTH_SECRET;}
function checkWriteOrigin(request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new CatalogError(403,'This request must come from the site.');if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new CatalogError(415,'Send this form as JSON.');}
async function catalogBody(request,maxBytes=16000){
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new CatalogError(413,'This form is too large.');
 const reader=request.body?.getReader(),decoder=new TextDecoder();let text='',bytes=0;
 if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new CatalogError(413,'This form is too large.');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}
 try{const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body;}catch{throw new CatalogError(400,'This form could not be read.');}
}
function cleanTitle(value){if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw new CatalogError(400,'Use a title between 1 and 100 characters.');return value.trim();}
function parseCatalogPost(value){
 try{const url=new URL(String(value));if(url.protocol!=='https:'||!['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(url.hostname))return null;const match=url.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d{10,25})(?:\/video\/([1-4]))?\/?$/);if(!match)return null;return {id:match[1],part:match[2]?Number(match[2]):null,key:match[1]+(match[2]?'/video/'+match[2]:'')};}catch{return null;}
}
function sourceKey(item){return item.url?parseCatalogPost(item.url)?.key||'item:'+item.id:'photo:'+item.id;}
function categoryNames(item){return [...new Set([item.category,...(item.collections||[])].filter(Boolean))];}
async function loadCatalogState(db,baseline){
 const [categoryRows,entryRows]=await Promise.all([db.prepare('SELECT id,name,name_key,position FROM catalog_categories ORDER BY position,name').all(),db.prepare('SELECT id,source_key,media_key,title,item_json,category_ids,status,revision,created_at,updated_at FROM catalog_entries').all()]);
 const categoryMap=new Map(defaultCatalogCategories.map(c=>[c.id,{...c}]));for(const row of categoryRows.results)categoryMap.set(row.id,{id:row.id,name:row.name,position:row.position});
 const categories=[...categoryMap.values()].sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name));
 const originalNameIds=new Map(defaultCatalogCategories.map(c=>[c.name,c.id]));
 const entries=new Map(baseline.map(item=>[item.id,{...item,categoryIds:categoryNames(item).map(name=>originalNameIds.get(name)).filter(Boolean),status:'published',revision:0,createdAt:null,updatedAt:null,sourceKey:sourceKey(item)}]));
 for(const row of entryRows.results)entries.set(row.id,{...JSON.parse(row.item_json),id:row.id,title:row.title,categoryIds:JSON.parse(row.category_ids),status:row.status,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,sourceKey:row.source_key});
 for(const item of entries.values()){const names=item.categoryIds.map(id=>categoryMap.get(id)?.name).filter(Boolean);item.category=names[0]||'Uncategorized';item.collections=names;delete item.custom;}
 return {categories,entries};
}
function manilaDay(timestamp){
 return new Date(timestamp+8*60*60*1000).toISOString().slice(0,10);
}
function checkedClipDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new CatalogError(400,'Choose a valid clip date.');
 const timestamp=Date.parse(value+'T00:00:00+08:00');
 if(!Number.isFinite(timestamp)||manilaDay(timestamp)!==value||value<'0001-01-01'||value>manilaDay(Date.now()))throw new CatalogError(400,'Choose today or an earlier clip date.');
 return timestamp;
}
function publicCatalogItem(item){const {status,revision,createdAt,updatedAt,sourceKey,categoryIds,titleSource,suggestedCategory,...publicItem}=item;const post=parseCatalogPost(item.url);
 if(item.clipDate){
  publicItem.postedAt=Date.parse(item.clipDate+'T00:00:00+08:00');
 }else if(post){
  const timestamp=Number((BigInt(post.id)>>22n)+1288834974657n);
  if(timestamp>1288834974657&&timestamp<=Date.now())publicItem.postedAt=timestamp;
 }
 return publicItem;
}
async function rateLimit(request,env,label,maximum,windowMs){
 const secret=requireAuthSecret(env),identity=(env.ADMIN_AUTH_MODE==='password'?request.headers.get('cf-connecting-ip'):request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip'))||'anonymous';
 const key=hex(await catalogHmac(secret,'rate:v1:'+label+':'+identity)),now=Date.now(),cutoff=now-windowMs;
 const result=await env.DB.prepare('INSERT INTO request_limits (key,window_start,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN ? ELSE window_start END RETURNING attempts').bind(key,now,cutoff,cutoff,now).first();
 if(result.attempts>maximum)throw new CatalogError(429,'Too many attempts. Please wait a few minutes and try again.');
}
function sessionToken(request){const value=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(adminCookie+'='))?.slice(adminCookie.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
function sessionCookie(request,token,age=28800){return adminCookie+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(new URL(request.url).protocol==='https:'?'; Secure':'');}
async function sessionOwner(request,env){const owner=ownerIdentity(request,env);if(!owner)return null;if(env.ADMIN_AUTH_MODE!=='password')return owner;if(!env.ADMIN_AUTH_SECRET)return null;return owner+':'+hex(await catalogHmac(env.ADMIN_AUTH_SECRET,'session-owner:v1:'+env.ADMIN_PASSWORD));}
export async function validAdminSession(request,env){const token=sessionToken(request);if(!token||!env.DB)return false;const owner=await sessionOwner(request,env);if(!owner)return false;const row=await env.DB.prepare('SELECT owner_id,expires_at FROM admin_sessions WHERE token_hash=?').bind(await sha256(token)).first();return row?.owner_id===owner&&row.expires_at>Date.now();}
async function requireAdminSession(request,env){requireOwner(request,env);if(!await validAdminSession(request,env))throw new CatalogError(401,'Your admin session has ended. Sign in again.');}
async function createAdminSession(request,env){requireOwner(request,env);const owner=await sessionOwner(request,env),token=randomHex(32),now=Date.now();await env.DB.batch([env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO admin_sessions (token_hash,owner_id,expires_at) VALUES (?,?,?)').bind(await sha256(token),owner,now+28800000)]);return sessionCookie(request,token);}
function cleanCategoryName(value){const name=cleanTitle(value).normalize('NFKC').replace(/\s+/g,' ');if(name.length>40)throw new CatalogError(400,'Use a category name up to 40 characters.');return name;}
function categoryKey(name){return name.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase();}
function validatedCategoryIds(values,state,allowEmpty=false){if(!Array.isArray(values)||values.length<(allowEmpty?0:1)||values.length>20)throw new CatalogError(400,'Choose at least one category.');const ids=[...new Set(values)];if(ids.some(id=>typeof id!=='string'||!state.categories.some(c=>c.id===id)))throw new CatalogError(400,'Choose an existing category.');return ids;}
async function resolveSubmittedVideo(post){
 const endpoint=new URL('https://cdn.syndication.twimg.com/tweet-result');endpoint.search=new URLSearchParams({id:post.id,lang:'en',token:getToken(post.id)});
 let response,data;try{response=await fetch(endpoint.href,{headers:{accept:'application/json','user-agent':'JeoleeOnRepeat/1.0'},signal:AbortSignal.timeout(12000)});if(!response.ok){console.warn('Public video metadata response',response.status,(await response.text()).slice(0,240));throw new Error();}data=await response.json();}catch(error){console.warn('Public video metadata check failed',post.id,response?.status||error.name);throw new CatalogError(422,'This public video could not be checked. Please try again later.');}
 const video=extractVideo(data,post.id,post.part);if(!video)throw new CatalogError(422,'No playable public video was found in this post.');
 const selected=post.part?data.mediaDetails[post.part-1]:data.mediaDetails.find(m=>m.type==='video');
 const match=selected.media_url_https.match(/\/(?:amplify_video_thumb|ext_tw_video_thumb)\/([^/]+)/);
 video.mediaKey=match?match[1]:await sha256(selected.media_url_https);return video;
}
export async function catalogApi(request,env,baseline){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/catalog')&&!path.startsWith('/api/admin/')&&path!=='/api/submissions'&&!path.startsWith('/api/wiki'))return null;
 try{
  const db=requireCatalogDb(env);
  if(path.startsWith('/api/wiki')||path.startsWith('/api/admin/wiki'))return await wikiApi(request,env,{db,json:catalogJson,fail:(status,message)=>{throw new CatalogError(status,message);},body:()=>catalogBody(request,48000),write:()=>checkWriteOrigin(request),admin:()=>requireAdminSession(request,env),limit:()=>rateLimit(request,env,'wiki-submission',5,600000)});
  if(path==='/api/catalog'&&request.method==='GET'){const state=await loadCatalogState(db,baseline);return catalogJson({categories:state.categories,items:[...state.entries.values()].filter(i=>i.status==='published').map(publicCatalogItem)});}
  if(path==='/api/admin/session'&&request.method==='GET'){
   if(env.ADMIN_AUTH_MODE==='password')return catalogJson({authenticated:await validAdminSession(request,env),requiresOwnerSignIn:false,setupRequired:false,passwordManagedExternally:true});
   if(!ownerIdentity(request,env))return catalogJson({authenticated:false,requiresOwnerSignIn:true,setupRequired:false});
   const config=await db.prepare('SELECT id FROM admin_config WHERE id=1').first();return catalogJson({authenticated:await validAdminSession(request,env),requiresOwnerSignIn:false,setupRequired:!config});
  }
  if(!['POST','PATCH','DELETE'].includes(request.method)&&!path.startsWith('/api/admin/catalog'))throw new CatalogError(405,'This action is not available.');
  if(['POST','PATCH','DELETE'].includes(request.method))checkWriteOrigin(request);
  if(env.ADMIN_AUTH_MODE==='password'&&['/api/admin/setup','/api/admin/password'].includes(path))throw new CatalogError(405,'The admin password is managed in site settings.');
  if(path==='/api/admin/setup'&&request.method==='POST'){
   requireOwner(request,env);const secret=requireAuthSecret(env);await rateLimit(request,env,'setup',5,900000);const body=await catalogBody(request);
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new CatalogError(400,'Use a password between 12 and 128 characters.');
   const salt=randomHex(24),hash=await passwordDigest(body.password,salt,secret);
   const result=await db.prepare('INSERT INTO admin_config (id,password_hash,password_salt,iterations,created_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(hash,salt,authIterations,Date.now()).run();
   if(!result.meta.changes)throw new CatalogError(409,'An admin password is already set. Sign in instead.');
   return catalogJson({authenticated:true},201,{'set-cookie':await createAdminSession(request,env)});
  }
  if(path==='/api/admin/login'&&request.method==='POST'){
   if(env.ADMIN_AUTH_MODE==='password'){
    if(!ownerIdentity(request,env))throw new CatalogError(503,'Admin sign-in is not configured yet.');
    const secret=requireAuthSecret(env);await rateLimit(request,env,'login',5,900000);const body=await catalogBody(request);
    if(typeof body.password!=='string'||body.password.length>128||!equalDigest(hex(await catalogHmac(secret,'login:v1:'+body.password)),hex(await catalogHmac(secret,'login:v1:'+env.ADMIN_PASSWORD))))throw new CatalogError(401,'That password did not match.');
    return catalogJson({authenticated:true},200,{'set-cookie':await createAdminSession(request,env)});
   }
   requireOwner(request,env);const secret=requireAuthSecret(env);await rateLimit(request,env,'login',5,900000);const body=await catalogBody(request),config=await db.prepare('SELECT password_hash,password_salt,iterations FROM admin_config WHERE id=1').first();
   if(!config)throw new CatalogError(409,'Create your admin password first.');
   if(typeof body.password!=='string'||body.password.length>128||!equalDigest(await passwordDigest(body.password,config.password_salt,secret,config.iterations),config.password_hash))throw new CatalogError(401,'That password did not match.');
   return catalogJson({authenticated:true},200,{'set-cookie':await createAdminSession(request,env)});
  }
  if(path==='/api/admin/logout'&&request.method==='POST'){
   const token=sessionToken(request);if(token)await db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256(token)).run();return catalogJson({authenticated:false},200,{'set-cookie':sessionCookie(request,'',0)});
  }
  if(path==='/api/submissions'&&request.method==='POST'){
   await rateLimit(request,env,'submission',await validAdminSession(request,env)?60:5,600000);const body=await catalogBody(request),post=parseCatalogPost(body.url),title=cleanTitle(body.title);if(!post)throw new CatalogError(400,'Paste a full public X video post link.');
   const clipDate=body.clipDate??manilaDay(Date.now());checkedClipDate(clipDate);
   const state=await loadCatalogState(db,baseline),suggestedCategory=body.suggestedCategory===undefined?null:cleanCategoryName(body.suggestedCategory);
   if(suggestedCategory&&body.categoryId)throw new CatalogError(400,'Choose an existing category or suggest a new one.');
   if(suggestedCategory&&state.categories.some(c=>categoryKey(c.name)===categoryKey(suggestedCategory)))throw new CatalogError(400,'That category already exists. Choose it from the list.');
   const categoryIds=suggestedCategory?[]:validatedCategoryIds([body.categoryId],state),video=await resolveSubmittedVideo(post),key=sourceKey({url:video.sourceUrl});
   if([...state.entries.values()].some(i=>i.sourceKey===key||i.mediaKey&&i.mediaKey===video.mediaKey))throw new CatalogError(409,'That video is already in the library or review queue.');
   const id='submitted-'+crypto.randomUUID(),now=Date.now(),item={...video,id,title,url:video.sourceUrl,kind:'clip',clipDate,...(suggestedCategory?{suggestedCategory}:{})};
   try{await db.prepare('INSERT INTO catalog_entries (id,source_key,media_key,title,item_json,category_ids,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,\'pending\',1,?,?)').bind(id,key,video.mediaKey,title,JSON.stringify(item),JSON.stringify(categoryIds),now,now).run();}catch(error){if(String(error.message).includes('UNIQUE'))throw new CatalogError(409,'That video is already in the review queue.');throw error;}
   return catalogJson({id,status:'pending',message:'Submitted for review. It will appear after approval.'},201);
  }
  await requireAdminSession(request,env);
  if(path==='/api/admin/catalog'&&request.method==='GET'){const state=await loadCatalogState(db,baseline);return catalogJson({categories:state.categories,items:[...state.entries.values()].map(i=>({...publicCatalogItem(i),suggestedCategory:i.suggestedCategory||null,categoryIds:i.categoryIds,status:i.status,revision:i.revision,createdAt:i.createdAt,updatedAt:i.updatedAt}))});}
  if(path==='/api/admin/categories'&&request.method==='POST'){
   const body=await catalogBody(request),name=cleanCategoryName(body.name);
   const state=await loadCatalogState(db,baseline),nameKey=categoryKey(name);if(state.categories.some(c=>categoryKey(c.name)===nameKey))throw new CatalogError(409,'That category already exists.');
   const id='category-'+crypto.randomUUID(),position=Math.max(...state.categories.map(c=>c.position),0)+1;try{await db.prepare('INSERT INTO catalog_categories (id,name,name_key,position,created_at) VALUES (?,?,?,?,?)').bind(id,name,nameKey,position,Date.now()).run();}catch(error){if(String(error.message).includes('UNIQUE'))throw new CatalogError(409,'That category already exists.');throw error;}
   return catalogJson({id,name,position},201);
  }
  const edit=path.match(/^\/api\/admin\/clips\/([A-Za-z0-9_-]{1,100})$/);
  if(edit&&request.method==='PATCH'){
   const body=await catalogBody(request),state=await loadCatalogState(db,baseline),item=state.entries.get(edit[1]);if(!item)throw new CatalogError(404,'This clip was not found.');
   if(body.revision!==item.revision)throw new CatalogError(409,'This clip changed in another session. Reload before saving.');
   const title=body.title===undefined?item.title:cleanTitle(body.title),status=body.status===undefined?item.status:body.status;
   if(!['published','pending','rejected','deleted'].includes(status))throw new CatalogError(400,'Choose a valid review action.');
   let suggestedCategory=item.suggestedCategory;
   if(body.suggestedCategory!==undefined){if(!suggestedCategory)throw new CatalogError(400,'This clip has no category suggestion.');suggestedCategory=cleanCategoryName(body.suggestedCategory);}
   const newName=body.newCategoryName===undefined?null:cleanCategoryName(body.newCategoryName);
   if(newName&&(!suggestedCategory||status!=='published'))throw new CatalogError(400,'Publish a suggested category when approving its clip.');
   const categoryIds=body.categoryIds===undefined?[...item.categoryIds]:validatedCategoryIds(body.categoryIds,state,!!newName||!!suggestedCategory&&status!=='published');
   let createdCategory=null;
   if(newName){const existing=state.categories.find(c=>categoryKey(c.name)===categoryKey(newName));createdCategory=existing?null:{id:'category-'+crypto.randomUUID(),name:newName,position:Math.max(...state.categories.map(c=>c.position),0)+1};const id=existing?.id||createdCategory.id;if(!categoryIds.includes(id))categoryIds.push(id);}
   if(status==='published'&&!categoryIds.length)throw new CatalogError(400,'Choose an existing category or publish the suggested category.');
   if(body.clipDate!==undefined)checkedClipDate(body.clipDate);
   const now=Date.now(),storedItem={...publicCatalogItem(item),...(body.clipDate!==undefined?{clipDate:body.clipDate}:{}),...(suggestedCategory&&status!=='published'?{suggestedCategory}:{})};
   const entryStatement=item.revision===0?db.prepare('INSERT INTO catalog_entries (id,source_key,media_key,title,item_json,category_ids,status,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING').bind(item.id,item.sourceKey,item.mediaKey||null,title,JSON.stringify(storedItem),JSON.stringify(categoryIds),status,now,now):db.prepare('UPDATE catalog_entries SET title=?,item_json=?,category_ids=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(title,JSON.stringify(storedItem),JSON.stringify(categoryIds),status,now,item.id,item.revision);
   let result;
   if(createdCategory){
    const createStatement=db.prepare("INSERT INTO catalog_categories (id,name,name_key,position,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM catalog_entries WHERE id=? AND revision=? AND status='published' AND instr(category_ids,?)>0)").bind(createdCategory.id,createdCategory.name,categoryKey(createdCategory.name),createdCategory.position,now,item.id,item.revision+1,JSON.stringify(createdCategory.id));
    try{[result]=await db.batch([entryStatement,createStatement]);}catch(error){if(String(error.message).includes('UNIQUE'))throw new CatalogError(409,'That category was just created. Reopen the clip and choose it from the list.');throw error;}
   }else result=await entryStatement.run();
   if(!result.meta.changes)throw new CatalogError(409,'This clip changed in another session. Reload before saving.');
   return catalogJson({id:item.id,status,revision:item.revision+1});
  }
  if(path==='/api/admin/password'&&request.method==='POST'){
   const body=await catalogBody(request),secret=requireAuthSecret(env),config=await db.prepare('SELECT password_hash,password_salt,iterations FROM admin_config WHERE id=1').first();await rateLimit(request,env,'password',5,900000);
   if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!equalDigest(await passwordDigest(body.currentPassword,config.password_salt,secret,config.iterations),config.password_hash))throw new CatalogError(401,'Your current password did not match.');
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw new CatalogError(400,'Use a new password between 12 and 128 characters.');
   const salt=randomHex(24),hash=await passwordDigest(body.password,salt,secret);await db.batch([db.prepare('UPDATE admin_config SET password_hash=?,password_salt=?,iterations=? WHERE id=1').bind(hash,salt,authIterations),db.prepare('DELETE FROM admin_sessions')]);
   return catalogJson({authenticated:true},200,{'set-cookie':await createAdminSession(request,env)});
  }
  throw new CatalogError(404,'This admin action was not found.');
 }catch(error){if(error instanceof CatalogError)return catalogJson({error:error.message},error.status);console.error('Catalog API failed',path,error.message);return catalogJson({error:'This change could not be saved. Please try again.'},500);}
}

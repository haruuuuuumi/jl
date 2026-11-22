import {getToken} from './video.mjs';
import {validAdminSession} from './catalog.mjs';
export const FANDOM_ACCOUNTS=[{handle:'jeoleenation',name:'Jeolee Nation'},{handle:'official_jeolee',name:'Jeolee Official'},{handle:'withjeolee',name:'With Jeolee'}];
const halfDay=43200000,offset=28800000;
export const nextFandomCheck=(now=Date.now())=>(Math.floor((now+offset)/halfDay)+1)*halfDay-offset;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
class SourceError extends Error{constructor(message,retryAt=0,status=0){super(message);this.retryAt=retryAt;this.status=status;}}
async function sourceResponse(fetchImpl,url,accept,now){
 let response;try{response=await fetchImpl(url,{headers:{accept},redirect:'follow',signal:AbortSignal.timeout(12000)});}catch{throw new SourceError('The public source could not be reached.');}
 if(!response.ok){const header=response.headers.get('retry-after'),seconds=Number(header),retry=header?(Number.isFinite(seconds)?now+seconds*1000:Date.parse(header)):0;throw new SourceError('Public source returned HTTP '+response.status+'.',Math.max(Number.isFinite(retry)?retry:0,[403,429].includes(response.status)?nextFandomCheck(now):0),response.status);}
 return response;
}
export function profilePostIds(html,handle){
 const ids=[],pattern=/href=["'](?:https?:\/\/(?:www\.)?(?:x|twitter)\.com)?\/([A-Za-z0-9_]+)\/status\/(\d{10,25})(?:[/?#][^"']*)?["']/g;let match;
 while((match=pattern.exec(html))&&ids.length<6)if(match[1].toLowerCase()===handle.toLowerCase()&&!ids.includes(match[2]))ids.push(match[2]);return ids;
}
const decode=text=>String(text).replace(/&(amp|lt|gt|quot|#39|nbsp);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",nbsp:' '})[entity]);
export function cardFromPost(data,id,account){
 if(data.__typename!=='Tweet'||data.user?.screen_name?.toLowerCase()!==account.handle||String(data.id_str||data.id)!==id)return null;
 const createdAt=Date.parse(data.created_at),text=decode(data.text||data.full_text||'').trim();if(!Number.isFinite(createdAt)||!text)return null;
 const media=(data.mediaDetails||[]).find(m=>/^https:\/\/pbs\.twimg\.com\//.test(m.media_url_https||'')),image=media?.media_url_https;
 return {id:'x-'+id,postId:id,handle:account.handle,title:[...text.split('\n').find(l=>l.trim())].slice(0,140).join(''),summary:[...text].slice(0,500).join(''),createdAt:new Date(createdAt).toISOString(),date:new Date(createdAt).toISOString().slice(0,10),kind:'fandom',label:'Fandom post',source:account.name+' · @'+account.handle,url:'https://x.com/'+account.handle+'/status/'+id,...(image?{image,imageFromPost:true}:{})};
}
// Owner-supplied public post: a first-card candidate, not a substitute timeline.
export const FANDOM_BOOTSTRAP_POSTS=[{handle:'jeoleenation',id:'2124217098411077792'}];
export async function collectFandomUpdates({fetchImpl=fetch,knownPosts=[],now=Date.now(),bootstrapPosts=FANDOM_BOOTSTRAP_POSTS}={}){
 const known=new Map(knownPosts.map(p=>[p.postId,p])),posts=new Map(),errors=[];
 let profilesRead=0,retryAfter=0,metadataPaused=false;
 const record=(error,account,id)=>{
  errors.push({handle:account.handle,...(id?{postId:id}:{}),message:error instanceof SourceError?error.message:'Source data could not be read.'});
  retryAfter=Math.max(retryAfter,error.retryAt||0);
 };
 for(const account of FANDOM_ACCOUNTS){
  let ids=[];
  try{
   const response=await sourceResponse(fetchImpl,'https://x.com/'+account.handle,'text/html',now),html=await response.text();
   if(html.length>3000000)throw new SourceError('The public page was too large to read safely.');
   ids=profilePostIds(html,account.handle);
   if(!ids.length)throw new SourceError('The public page did not expose readable post links.');
   profilesRead++;
  }catch(error){record(error,account);}
  ids=[...new Set([...ids,...bootstrapPosts.filter(p=>p.handle===account.handle&&/^\d{10,25}$/.test(p.id)).map(p=>p.id)])];
  for(const id of ids){
   if(known.has(id)){posts.set(id,known.get(id));continue;}
   if(metadataPaused)continue;
   try{
    const endpoint=new URL('https://cdn.syndication.twimg.com/tweet-result');endpoint.search=new URLSearchParams({id,lang:'en',token:getToken(id)});
    const response=await sourceResponse(fetchImpl,endpoint.href,'application/json',now),data=await response.json();
    if(data.__typename==='TweetTombstone')throw new SourceError('X did not make this post available to public embeds.');
    const card=cardFromPost(data,id,account);
    if(!card)throw new SourceError('Post author, content or original date could not be verified.');
    posts.set(id,card);
   }catch(error){record(error,account,id);if([403,429].includes(error.status))metadataPaused=true;}
  }
 }
 const sorted=[...posts.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.postId.localeCompare(a.postId));
 return {posts:sorted.slice(0,3).filter(p=>!known.has(p.postId)),profilesRead,errors,retryAfter};
}
async function state(db){return await db.prepare('SELECT * FROM fandom_update_state WHERE id=1').first();}
export async function syncFandomUpdates(env,{fetchImpl=fetch,now=Date.now(),initialOnly=false,manual=false,bootstrapPosts}={}){
 const db=env.DB;if(!db)throw new Error('The updates database is unavailable.');
 await db.prepare("INSERT INTO fandom_update_state (id,lease_until,lock_token,last_error,retry_after) VALUES (1,0,'','',0) ON CONFLICT(id) DO NOTHING").run();const before=await state(db);
 if(manual&&before.last_attempt_at&&now-before.last_attempt_at<60000)return {outcome:'recent',imported:0,nextCheck:nextFandomCheck(now)};
 const lock=crypto.randomUUID();const acquired=await db.prepare('UPDATE fandom_update_state SET lease_until=?,lock_token=?,last_attempt_at=? WHERE id=1 AND lease_until<=? AND retry_after<=? AND (?=0 OR last_attempt_at IS NULL) RETURNING id').bind(now+600000,lock,now,now,now,initialOnly?1:0).first();
 if(!acquired)return {outcome:'skipped',imported:0,nextCheck:Math.max(before.retry_after,nextFandomCheck(now))};
 try{
  const existing=await db.prepare('SELECT item_json FROM fandom_updates ORDER BY posted_at DESC LIMIT 60').all(),knownPosts=existing.results.map(r=>JSON.parse(r.item_json));const result=await collectFandomUpdates({fetchImpl,knownPosts,now,bootstrapPosts});
  const statements=result.posts.map(p=>db.prepare('INSERT INTO fandom_updates (post_id,handle,item_json,posted_at,imported_at) VALUES (?,?,?,?,?) ON CONFLICT(post_id) DO NOTHING').bind(p.postId,p.handle,JSON.stringify(p),Date.parse(p.createdAt),now));
  const success=result.profilesRead===FANDOM_ACCOUNTS.length&&!result.errors.length||result.posts.length>0;
  statements.push(db.prepare("UPDATE fandom_update_state SET last_success_at=COALESCE(?,last_success_at),last_error=?,retry_after=?,lease_until=0,lock_token='' WHERE id=1 AND lock_token=?").bind(success?now:null,JSON.stringify(result.errors),result.retryAfter,lock));
  const saved=await db.batch(statements),imported=saved.slice(0,-1).reduce((n,r)=>n+(r.meta.changes||0),0);
  return {outcome:result.errors.length?(imported?'partial':'unavailable'):(imported?'updated':'no_new'),imported,profilesRead:result.profilesRead,errors:result.errors,nextCheck:Math.max(result.retryAfter,nextFandomCheck(now))};
 }catch(error){await db.prepare("UPDATE fandom_update_state SET last_error=?,lease_until=0,lock_token='' WHERE id=1 AND lock_token=?").bind(JSON.stringify([{message:'The update check failed; saved posts were kept.'}]),lock).run();throw error;}
}
export async function fandomUpdatesApi(request,env,ctx,options={}){
 const url=new URL(request.url),publicFeed=url.pathname==='/api/updates',admin=url.pathname.startsWith('/api/admin/updates');if(!publicFeed&&!admin)return null;if(!env.DB)return json({error:'Updates are unavailable right now.'},503);
 if(admin&&!await validAdminSession(request,env))return json({error:'Sign in to use admin.'},401);
 try{
  if(url.pathname==='/api/admin/updates/sync'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Submit this request from the site.'},403);
   return json(await syncFandomUpdates(env,{...options,manual:true}));
  }
  if(request.method!=='GET')return json({error:'This action is not available.'},405);
  const current=await state(env.DB);
  if(publicFeed){const rows=await env.DB.prepare('SELECT item_json FROM fandom_updates ORDER BY posted_at DESC,post_id DESC LIMIT 30').all();if(!current?.last_attempt_at&&ctx?.waitUntil)ctx.waitUntil(syncFandomUpdates(env,{...options,initialOnly:true}).catch(()=>{}));return json({items:rows.results.map(r=>JSON.parse(r.item_json)),lastSuccessAt:current?.last_success_at||null,lastCheckFailed:!!current?.last_error&&current.last_error!=='[]'});}
  return json({lastAttemptAt:current?.last_attempt_at||null,lastSuccessAt:current?.last_success_at||null,errors:JSON.parse(current?.last_error||'[]'),nextCheck:Math.max(current?.retry_after||0,nextFandomCheck())});
 }catch{return json({error:'The update check could not finish. Saved posts were kept.'},503);}
}

const wikiTopics=['Moments','Songs','Timeline','Fan guide','News','Trends'];
const wikiFields='id,title,summary,topic,body,sources_json,revision,created_at,updated_at';
function wikiPage(row){if(!row)return null;return {id:row.id,title:row.title,summary:row.summary,topic:row.topic,body:row.body,sources:JSON.parse(row.sources_json),revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,...(row.deleted===undefined?{}:{deleted:!!row.deleted})};}
function wikiProposal(row){return {id:row.id,pageId:row.page_id,baseRevision:row.base_revision,title:row.title,summary:row.summary,topic:row.topic,body:row.body,sources:JSON.parse(row.sources_json),contributor:row.contributor,changeNote:row.change_note,status:row.status,revision:row.revision,reviewNote:row.review_note,createdAt:row.created_at,reviewedAt:row.reviewed_at};}
function wikiText(value,label,min,max,fail){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(400,label+' must be '+min+'–'+max+' characters.');return value.trim();}
function wikiContent(body,fail){
 const title=wikiText(body.title,'Title',1,100,fail),summary=wikiText(body.summary,'Summary',15,240,fail),content=wikiText(body.body,'Page content',40,8000,fail);
 if(!wikiTopics.includes(body.topic))fail(400,'Choose an existing topic.');
 if(!Array.isArray(body.sources)||!body.sources.length||body.sources.length>8)fail(400,'Add between 1 and 8 source links.');
 const sources=[...new Set(body.sources.map(value=>{try{if(typeof value!=='string'||value.length>1000)throw new Error();const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))throw new Error();return url.href;}catch{fail(400,'Use complete HTTPS source links.');}}))];
 return {title,summary,topic:body.topic,body:content,sources};
}
const wikiTitleKey=title=>title.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
async function wikiDigest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
function wikiOffset(url){const value=url.searchParams.get('offset')||'0';return /^\d{1,7}$/.test(value)?Number(value):0;}
export async function wikiApi(request,env,{db,json,fail,body:readBody,write,admin,limit}){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(['POST','PATCH'].includes(method))write();
 if(path==='/api/wiki/pages'&&method==='GET'){
  const q=(url.searchParams.get('q')||'').trim().slice(0,100).toLowerCase(),topic=url.searchParams.get('topic')||'',offset=wikiOffset(url);
  const result=await db.prepare('SELECT '+wikiFields+' FROM wiki_pages WHERE deleted=0 AND (?=\'\' OR instr(lower(title||\' \'||summary||\' \'||body),?)>0) AND (?=\'\' OR topic=?) ORDER BY updated_at DESC,id LIMIT 31 OFFSET ?').bind(q,q,topic,topic,offset).all();
  return json({topics:wikiTopics,pages:result.results.slice(0,30).map(row=>{const {body,...page}=wikiPage(row);return page;}),hasMore:result.results.length>30});
 }
 const detail=path.match(/^\/api\/wiki\/pages\/([A-Za-z0-9-]{1,60})$/);
 if(detail&&method==='GET'){
  const row=await db.prepare('SELECT '+wikiFields+' FROM wiki_pages WHERE id=? AND deleted=0').bind(detail[1]).first();if(!row)fail(404,'This page is not available.');
  const history=await db.prepare('SELECT id,contributor,change_note,reviewed_at FROM wiki_proposals WHERE page_id=? AND status=\'approved\' ORDER BY reviewed_at DESC,id DESC LIMIT 30').bind(row.id).all();
  return json({page:wikiPage(row),history:history.results.map(r=>({id:r.id,contributor:r.contributor,changeNote:r.change_note,reviewedAt:r.reviewed_at}))});
 }
 if(path==='/api/wiki/proposals'&&method==='POST'){
  await limit();const input=await readBody(),content=wikiContent(input,fail),contributor=input.contributor?wikiText(input.contributor,'Cupid nickname',1,40,fail):'A Cupid',changeNote=wikiText(input.changeNote||'New page','Change summary',1,240,fail);
  let pageId=null,baseRevision=0;
  if(input.pageId){if(typeof input.pageId!=='string'||input.pageId.length>60)fail(400,'Choose a valid page.');const page=await db.prepare('SELECT id,revision FROM wiki_pages WHERE id=? AND deleted=0').bind(input.pageId).first();if(!page)fail(404,'This page is not available.');if(input.baseRevision!==page.revision)fail(409,'This page changed. Reopen it and review the latest version before suggesting an edit.');pageId=page.id;baseRevision=page.revision;}
  else if(await db.prepare('SELECT id FROM wiki_pages WHERE title_key=? AND deleted=0').bind(wikiTitleKey(content.title)).first())fail(409,'A page with this title already exists. Suggest an edit to that page instead.');
  const id=crypto.randomUUID(),fingerprint=await wikiDigest(JSON.stringify({pageId,baseRevision,...content})),now=Date.now();
  const result=await db.prepare('INSERT INTO wiki_proposals (id,page_id,base_revision,title,summary,topic,body,sources_json,contributor,change_note,fingerprint,status,revision,review_note,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,\'pending\',1,\'\',? WHERE NOT EXISTS (SELECT 1 FROM wiki_proposals WHERE fingerprint=? AND status=\'pending\')').bind(id,pageId,baseRevision,content.title,content.summary,content.topic,content.body,JSON.stringify(content.sources),contributor,changeNote,fingerprint,now,fingerprint).run();
  if(!result.meta.changes)fail(409,'This contribution is already waiting for review.');
  return json({id,status:'pending',message:'Your contribution is waiting for approval.'},201);
 }
 if(!path.startsWith('/api/admin/wiki'))fail(404,'This page action was not found.');
 await admin();
 if(path==='/api/admin/wiki'&&method==='GET'){
  const status=url.searchParams.get('status')||'pending',offset=wikiOffset(url);if(!['pending','approved','rejected','pages','trash'].includes(status))fail(400,'Choose a valid view.');
  const counts=await db.prepare('SELECT status,COUNT(*) AS count FROM wiki_proposals GROUP BY status').all();
  const pageCounts=await db.prepare('SELECT deleted,COUNT(*) AS count FROM wiki_pages GROUP BY deleted').all();
  const results=['pages','trash'].includes(status)?await db.prepare('SELECT '+wikiFields+',deleted FROM wiki_pages WHERE deleted=? ORDER BY updated_at DESC,id LIMIT 31 OFFSET ?').bind(status==='trash'?1:0,offset).all():await db.prepare('SELECT * FROM wiki_proposals WHERE status=? ORDER BY created_at DESC,id LIMIT 31 OFFSET ?').bind(status,offset).all();
  return json({items:results.results.slice(0,30).map(['pages','trash'].includes(status)?wikiPage:wikiProposal),hasMore:results.results.length>30,counts:{pending:0,approved:0,rejected:0,pages:0,trash:0,...Object.fromEntries(counts.results.map(r=>[r.status,r.count])),...Object.fromEntries(pageCounts.results.map(r=>[r.deleted?'trash':'pages',r.count]))},topics:wikiTopics});
 }
 const proposalMatch=path.match(/^\/api\/admin\/wiki\/proposals\/([A-Za-z0-9-]{1,60})$/);
 if(proposalMatch&&method==='GET'){
  const row=await db.prepare('SELECT * FROM wiki_proposals WHERE id=?').bind(proposalMatch[1]).first();if(!row)fail(404,'This contribution was not found.');
  const current=row.page_id?await db.prepare('SELECT '+wikiFields+',deleted FROM wiki_pages WHERE id=?').bind(row.page_id).first():null;
  return json({proposal:wikiProposal(row),current:wikiPage(current)});
 }
 if(proposalMatch&&method==='PATCH'){
  const input=await readBody(),row=await db.prepare('SELECT * FROM wiki_proposals WHERE id=?').bind(proposalMatch[1]).first();if(!row)fail(404,'This contribution was not found.');
  if(row.status!=='pending'||input.revision!==row.revision)fail(409,'This contribution changed. Reopen it before reviewing.');
  const action=input.action;if(!['save','approve','reject'].includes(action))fail(400,'Choose a review action.');
  const reviewNote=input.reviewNote?wikiText(input.reviewNote,'Review note',1,500,fail):'',now=Date.now();
  if(action==='reject'){
   const result=await db.prepare('UPDATE wiki_proposals SET status=\'rejected\',review_note=?,reviewed_at=?,revision=revision+1 WHERE id=? AND revision=? AND status=\'pending\'').bind(reviewNote,now,row.id,row.revision).run();if(!result.meta.changes)fail(409,'This contribution changed. Reopen it.');return json({id:row.id,status:'rejected'});
  }
  const content=wikiContent(input,fail),values=[content.title,content.summary,content.topic,content.body,JSON.stringify(content.sources)];
  if(action==='save'){
   const result=await db.prepare('UPDATE wiki_proposals SET title=?,summary=?,topic=?,body=?,sources_json=?,review_note=?,revision=revision+1 WHERE id=? AND revision=? AND status=\'pending\'').bind(...values,reviewNote,row.id,row.revision).run();if(!result.meta.changes)fail(409,'This contribution changed. Reopen it.');return json({id:row.id,status:'pending'});
  }
  const pageId=row.page_id||crypto.randomUUID(),current=row.page_id?await db.prepare('SELECT revision,deleted FROM wiki_pages WHERE id=?').bind(row.page_id).first():null;
  if(row.page_id&&(!current||current.deleted))fail(409,'The original page is in Trash. Restore it before approving this edit.');
  if(current&&(input.currentPageRevision!==current.revision||(row.base_revision!==current.revision&&!input.mergeConfirmed)))fail(409,'The published page changed. Compare the latest version, merge the changes, and confirm the new version before approval.');
  let pageStatement;
  if(current)pageStatement=db.prepare('UPDATE wiki_pages SET title=?,title_key=?,summary=?,topic=?,body=?,sources_json=?,revision=revision+1,last_proposal_id=?,updated_at=? WHERE id=? AND revision=? AND deleted=0 AND EXISTS (SELECT 1 FROM wiki_proposals WHERE id=? AND revision=? AND status=\'pending\')').bind(content.title,wikiTitleKey(content.title),content.summary,content.topic,content.body,JSON.stringify(content.sources),row.id,now,pageId,current.revision,row.id,row.revision);
  else pageStatement=db.prepare('INSERT INTO wiki_pages (id,title,title_key,summary,topic,body,sources_json,revision,last_proposal_id,deleted,created_at,updated_at) SELECT ?,?,?,?,?,?,?,1,?,0,?,? WHERE EXISTS (SELECT 1 FROM wiki_proposals WHERE id=? AND revision=? AND status=\'pending\') ON CONFLICT(title_key) DO NOTHING').bind(pageId,content.title,wikiTitleKey(content.title),content.summary,content.topic,content.body,JSON.stringify(content.sources),row.id,now,now,row.id,row.revision);
  let result;try{result=await db.batch([pageStatement,db.prepare('UPDATE wiki_proposals SET title=?,summary=?,topic=?,body=?,sources_json=?,page_id=?,status=\'approved\',review_note=?,reviewed_at=?,revision=revision+1 WHERE id=? AND revision=? AND status=\'pending\' AND EXISTS (SELECT 1 FROM wiki_pages WHERE id=? AND last_proposal_id=? AND revision=?)').bind(...values,pageId,reviewNote,now,row.id,row.revision,pageId,row.id,current?current.revision+1:1)]);}catch(error){if(String(error.message).includes('UNIQUE'))fail(409,'Another page already uses that title. Change the title or edit the existing page.');throw error;}
  if(!result[0].meta.changes||!result[1].meta.changes)fail(409,'This page or contribution changed. Reopen it before approving.');
  return json({id:row.id,pageId,status:'approved'});
 }
 const pageMatch=path.match(/^\/api\/admin\/wiki\/pages\/([A-Za-z0-9-]{1,60})$/);
 if(pageMatch&&method==='PATCH'){
  const input=await readBody();if(!['archive','restore'].includes(input.action))fail(400,'Choose a valid page action.');const deleted=input.action==='archive'?1:0;
  const result=await db.prepare('UPDATE wiki_pages SET deleted=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND deleted=?').bind(deleted,Date.now(),pageMatch[1],input.revision,1-deleted).run();if(!result.meta.changes)fail(409,'This page changed. Refresh before trying again.');return json({id:pageMatch[1],deleted:!!deleted});
 }
 fail(404,'This page action was not found.');
}

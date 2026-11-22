'use strict';
(() => {
 const S=window.SiteUI,W=window.WikiUI,$=s=>document.querySelector(s),params=new URL(location.href).searchParams,base=window.jeoleeHub;
 let remote=[],pages=[],topics=[...base.topics],shown=24,offset=0,hasMore=false,generation=0,busy=false;
 $('#updates-search').value=params.get('q')||'';$('#updates-kind').value=['coverage','fandom','community'].includes(params.get('kind'))?params.get('kind'):'';
 let source=params.get('source')||'';
 const filters=()=>({q:$('#updates-search').value.trim().slice(0,100),kind:$('#updates-kind').value,source:$('#updates-source').value||source});
 const matches=(item,f)=>!((f.kind&&item.kind!==f.kind)||(f.source&&item.source!==f.source)||(f.q&&!(item.title+' '+item.summary+' '+item.source).toLowerCase().includes(f.q.toLowerCase())));
 function paint(){
  const f=filters(),list=S.mergeUpdates(remote,pages.map(p=>S.pageUpdate(p))).filter(item=>matches(item,f)),visible=list.slice(0,shown);
  $('#updates-list').innerHTML=visible.map(item=>S.newsCard(item)).join('');S.onImageError($('#updates-list'));$('#updates-empty').hidden=!!list.length;$('#updates-more').hidden=visible.length>=list.length&&!hasMore;$('#updates-results').textContent='Showing '+visible.length+' '+(visible.length===1?'update':'updates')+(hasMore?' · more saved stories available':'');
 }
 function saveFilters(){const f=filters(),url=new URL(location.href);for(const [key,value]of Object.entries(f)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(null,'',url);}
 function sources(values){const all=[...new Set([...values,...pages.map(()=> 'Read the approved page')])].filter(Boolean).sort();$('#updates-source').innerHTML='<option value="">All sources</option>'+all.map(value=>'<option value="'+S.escape(value)+'">'+S.escape(value)+'</option>').join('');if(source&&!all.includes(source)){const option=document.createElement('option');option.value=source;option.textContent=source;$('#updates-source').append(option);}$('#updates-source').value=source;}
 function paintTopics(){const list=[...topics].sort((a,b)=>b.date.localeCompare(a.date));$('#updates-topics').innerHTML=list.map(item=>'<article><h3><a href="'+S.escape(item.url)+'"'+(item.kind==='community'?'':' target="_blank" rel="noopener noreferrer"')+'>'+S.escape(item.title)+'</a></h3><p>'+S.escape(item.summary)+'</p><small>'+S.escape(item.source)+' · '+S.date(item.date)+'</small></article>').join('');}
 async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Saved updates couldn’t load. Please try again.');return r.json();}
 async function load(more=false){
  const seq=++generation;if(!more)shown=24;busy=true;$('#updates-more').disabled=true;$('#updates-error').textContent='';$('#updates-retry').hidden=true;const f=filters(),query=new URLSearchParams({...f,offset:String(more?offset:0)});
  try{
   const data=await get('/api/updates?'+query);if(seq!==generation)return;remote=more?[...remote,...data.items]:data.items;offset=data.nextOffset;hasMore=data.hasMore;
   const freshest=[data.latestStoryAt,...pages.map(p=>p.updatedAt)].filter(Boolean).sort((a,b)=>b-a)[0];$('#latest-story').textContent=freshest?'Newest saved story: '+S.date(freshest)+'.':'No saved stories yet.';
   $('#update-check-state').textContent=(data.lastSuccessAt?'Last successful check: '+S.date(data.lastSuccessAt,true)+' PHT. ':'No successful public fanbase check yet. ')+(data.lastAttemptAt?'Last attempt: '+S.date(data.lastAttemptAt,true)+' PHT. ':'')+(data.lastCheckFailed?'The latest attempt could not read every source. Saved stories are shown.':'');
   sources(data.sources||[]);paint();
  }catch(error){if(seq!==generation)return;$('#updates-error').textContent=error.message;$('#updates-retry').hidden=false;$('#latest-story').textContent='Showing the stories already loaded.';paint();}
  finally{if(seq===generation){busy=false;$('#updates-more').disabled=false;}}
 }
 async function community(){const results=await Promise.allSettled(['News','Trends'].map(topic=>get('/api/wiki/pages?'+new URLSearchParams({topic}))));pages=results.flatMap(r=>r.status==='fulfilled'?r.value.pages:[]);topics=[...base.topics,...pages.filter(p=>p.topic==='Trends').map(p=>S.pageUpdate(p))];paintTopics();paint();}
 $('#updates-filter-form').addEventListener('submit',event=>{event.preventDefault();source=$('#updates-source').value;saveFilters();load();});
 for(const id of ['updates-kind','updates-source'])$('#'+id).addEventListener('change',()=>{source=$('#updates-source').value;saveFilters();load();});
 $('#updates-clear').addEventListener('click',()=>{$('#updates-search').value='';$('#updates-kind').value='';$('#updates-source').value='';source='';saveFilters();load();});$('#updates-retry').addEventListener('click',()=>load());
 $('#updates-more').addEventListener('click',async()=>{if(busy)return;shown+=24;if(hasMore)await load(true);else paint();});
 const draftKey='jeolee:update-draft:v2',receiptKey='jeolee:update-receipt:v2',fields=()=>({title:$('#suggest-title').value,url:$('#suggest-url').value,note:$('#suggest-note').value,topic:$('#suggest-topic').value});
 function draft(){const value=fields();if(!value.title.trim()&&!value.url.trim()&&!value.note.trim()){S.remove(draftKey);$('#discard-update-draft').hidden=true;return;}$('#update-draft-status').textContent=S.save(draftKey,value)?'Draft saved on this device.':'Draft saving is unavailable. Keep this tab open until you submit.';$('#discard-update-draft').hidden=false;}
 function receipt(value){if(!value||typeof value.title!=='string'||!Number.isFinite(value.submittedAt))return;$('#update-receipt-detail').textContent='“'+value.title+'” · Submitted '+S.date(value.submittedAt,true)+' PHT. This receipt confirms submission; it does not track later review decisions.';$('#update-receipt').hidden=false;}
 const saved=S.read(draftKey),last=S.read(receiptKey);if(saved){for(const [key,id]of[['title','suggest-title'],['url','suggest-url'],['note','suggest-note'],['topic','suggest-topic']])if(typeof saved[key]==='string')$('#'+id).value=saved[key];$('#update-draft-status').textContent='Your saved draft is back.';$('#discard-update-draft').hidden=false;}else if(last){receipt(last);$('#suggest-update-form').hidden=true;}
 $('#suggest-update-form').addEventListener('input',draft);$('#discard-update-draft').addEventListener('click',()=>{if(confirm('Discard this unsent update draft?')){$('#suggest-update-form').reset();S.remove(draftKey);$('#discard-update-draft').hidden=true;$('#update-draft-status').textContent='Unsent details are saved on this device.';}});
 $('#update-another').addEventListener('click',()=>{$('#update-receipt').hidden=true;$('#suggest-update-form').hidden=false;$('#suggest-title').focus();});
 $('#suggest-update-form').addEventListener('submit',async event=>{event.preventDefault();const value=fields(),button=$('#suggest-update-submit');button.disabled=true;button.textContent='Sending…';$('#suggest-update-error').textContent='';
  try{const url=new URL(value.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use a complete HTTPS source link.');const result=await W.request('/api/wiki/proposals',{title:value.title.trim(),summary:value.note.trim().slice(0,240),body:value.note.trim(),sources:[url.href],topic:value.topic,changeNote:'Suggested '+(value.topic==='Trends'?'fandom conversation':'news update'),contributor:'A Cupid'});const record={title:value.title.trim(),submittedAt:Date.now(),reference:result.id};S.save(receiptKey,record);S.remove(draftKey);$('#suggest-update-form').reset();$('#suggest-update-form').hidden=true;receipt(record);$('#update-another').focus();}
  catch(error){$('#suggest-update-error').textContent=error.message||'This suggestion couldn’t be submitted. Your draft is saved.';}finally{button.disabled=false;button.textContent='Send for review';}
 });
 paintTopics();community();load();if(params.get('topic')==='conversations')requestAnimationFrame(()=>$('#conversations').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
})();

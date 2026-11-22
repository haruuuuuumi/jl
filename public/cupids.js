'use strict';
(() => {
 const $=s=>document.querySelector(s),W=window.WikiUI;
 const S=window.SiteUI,draftStorage='jeolee:wiki-drafts:v2',receiptStorage='jeolee:wiki-receipt:v2';let drafts;try{const saved=S.read(draftStorage,[]);drafts=new Map(Array.isArray(saved)?saved:[]);}catch{drafts=new Map();}let draftKey='new',draftStored=true;
 function persistDrafts(){draftStored=S.save(draftStorage,[...drafts]);$('#wiki-draft-status').textContent=draftStored?'Draft saved on this device.':'Draft saving is unavailable. Keep this tab open until you submit.';}
 function rememberFilters(){const url=new URL(location.href);for(const [key,value] of [['q',$('#wiki-search').value.trim()],['topic',$('#wiki-topic').value]]){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}history.replaceState(null,'',url);}
 let pages=[],offset=0,requestGeneration=0,routeGeneration=0,activePage=null,dirty=false,submitting=false;
 const views=['wiki-index','wiki-reader','wiki-compose','wiki-receipt'];
 function view(id){views.forEach(name=>$('#'+name).hidden=name!==id);}
 function focusTitle(selector){$(selector)?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 function setBusy(value){submitting=value;$('#wiki-submit').disabled=value;$('#wiki-submit').textContent=value?'Sending…':'Send for approval';}
 function fields(){return {title:$('#contribution-title').value.trim(),summary:$('#contribution-summary').value.trim(),topic:$('#contribution-topic').value,body:$('#contribution-body').value.trim(),sources:$('#contribution-sources').value.split('\n').map(s=>s.trim()).filter(Boolean),contributor:$('#contribution-credit').value.trim(),changeNote:$('#contribution-note').value.trim()||($('#wiki-page-id').value?'Suggested edit':'New page'),...($('#wiki-page-id').value?{pageId:$('#wiki-page-id').value,baseRevision:Number($('#wiki-base-revision').value)}:{})};}
 async function loadIndex(more=false){
  const generation=++requestGeneration;$('#wiki-index-error').hidden=true;$('#wiki-empty').hidden=true;$('#wiki-more').disabled=true;$('#wiki-results').textContent='Finding pages…';
  try{const query=new URLSearchParams({q:$('#wiki-search').value.trim(),topic:$('#wiki-topic').value,offset:String(more?offset:0)}),data=await W.request('/api/wiki/pages?'+query,undefined,'GET');if(generation!==requestGeneration)return;
   pages=more?[...pages,...data.pages]:data.pages;offset=pages.length;
   $('#wiki-page-list').innerHTML=pages.map(page=>`<article class="wiki-page-row"><h2><a href="#page=${encodeURIComponent(page.id)}">${W.escape(page.title)}</a></h2><p>${W.escape(page.summary)}</p><p class="wiki-meta">${W.escape(page.topic)} · Updated ${W.date(page.updatedAt)}</p></article>`).join('');
   $('#wiki-more').hidden=!data.hasMore;$('#wiki-results').textContent=pages.length?pages.length+' approved '+(pages.length===1?'page':'pages')+(data.hasMore?' shown':''):'';
   $('#wiki-empty').hidden=pages.length>0;
   const searching=!!($('#wiki-search').value.trim()||$('#wiki-topic').value);$('#wiki-empty h2').textContent=searching?'No pages found yet.':'This story starts with us.';$('#wiki-empty p').textContent=searching?'Try another search or topic, or contribute a page of your own.':'Remember a moment everyone should know? Start a page with what happened and links to the original sources.';$('#wiki-empty a').textContent=searching?'Contribute a page':'Write the first page';
  }catch(error){if(generation!==requestGeneration)return;$('#wiki-results').textContent='';$('#wiki-index-error').hidden=false;$('#wiki-index-error p').textContent=error.message;$('#wiki-more').hidden=true;}finally{if(generation===requestGeneration)$('#wiki-more').disabled=false;}
 }
 function paintPage(data){
  const page=data.page;activePage=page;loadRelated(page);$('#wiki-article').hidden=false;$('#page-title').textContent=page.title;$('#page-summary').textContent=page.summary;$('#page-topic').textContent=page.topic;$('#page-meta').textContent='Approved version '+page.revision+' · Updated '+W.date(page.updatedAt);$('#page-body').innerHTML=W.bodyHTML(page.body);$('#page-sources').innerHTML=W.sourcesHTML(page.sources);$('#suggest-edit').href='#edit='+encodeURIComponent(page.id);
  const headings=[...$('#page-body').querySelectorAll('h2')];$('#page-contents').hidden=!headings.length;$('#page-contents').replaceChildren();if(headings.length){const label=document.createElement('p');label.textContent='On this page';$('#page-contents').append(label);for(const heading of headings){const button=document.createElement('button');button.className='wiki-toc-link';button.textContent=heading.textContent;button.addEventListener('click',()=>heading.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));$('#page-contents').append(button);}}
  $('#page-history').innerHTML=data.history.map(revision=>`<li>${W.escape(revision.changeNote)}<span>By ${W.escape(revision.contributor)} · Approved ${W.date(revision.reviewedAt)}</span></li>`).join('')||'<li>No earlier contributions.</li>';
  document.title=page.title+' — Cupids’ Space';focusTitle('#page-title');
 }
 async function loadRelated(page){try{const data=await W.request('/api/wiki/pages?'+new URLSearchParams({topic:page.topic}),undefined,'GET');if(activePage?.id!==page.id)return;$('#page-related').innerHTML=data.pages.filter(p=>p.id!==page.id).slice(0,3).map(p=>'<a href="#page='+encodeURIComponent(p.id)+'">'+W.escape(p.title)+'</a>').join('');$('#page-moments-link').href='/moments?q='+encodeURIComponent(page.title);}catch{$('#page-related').replaceChildren();}}
 function compose(page=null,topicPreset=null){
  activePage=page;draftKey=page?'edit:'+page.id:'new';const draft=drafts.get(draftKey);$('#wiki-form').reset();$('#wiki-page-id').value=page?.id||'';$('#wiki-base-revision').value=page?.revision||0;$('#compose-title').textContent=page?'A little more to the story.':'A page for the story.';$('#compose-description').textContent=page?'Suggest a new version. The approved page stays visible while your edit is reviewed.':'Share what you know, credit your sources, and send it for review. It won’t appear publicly until approved.';$('#compose-back').href=page?'#page='+page.id:'#';$('#wiki-form-error').textContent='';$('#wiki-form').hidden=false;$('#contribution-preview').hidden=true;$('#wiki-preview-toggle').setAttribute('aria-expanded','false');
  if(topicPreset)$('#contribution-topic').value=topicPreset;
  if(page){$('#contribution-title').value=page.title;$('#contribution-summary').value=page.summary;$('#contribution-topic').value=page.topic;$('#contribution-body').value=page.body;$('#contribution-sources').value=page.sources.join('\n');}
  if(draft){for(const [id,value] of Object.entries({title:draft.title,summary:draft.summary,topic:draft.topic,body:draft.body,sources:draft.sources.join('\n'),credit:draft.contributor,note:draft.changeNote}))$('#contribution-'+id).value=value;$('#wiki-base-revision').value=draft.baseRevision||0;$('#compose-description').textContent+=' Your unsent draft is back.';if(page&&draft.baseRevision!==page.revision)$('#wiki-form-error').textContent='This draft is based on an older version. Copy your changes, then discard the draft to start from the latest page.';}
  $('#wiki-reset-draft').hidden=!draft;$('#wiki-draft-status').textContent=draft?'Your saved draft is back.':'Unsent drafts are saved on this device.';setBusy(false);dirty=!!draft;view('wiki-compose');focusTitle('#contribution-title');
 }
 async function route(){
  const generation=++routeGeneration,hash=location.hash.slice(1);dirty=false;
  if(hash==='sent'){const last=S.read(receiptStorage);if(last){$('#receipt-message').textContent='“'+last.title+'” was sent for review.';$('#receipt-date').textContent='Submitted '+S.date(last.submittedAt,true)+' PHT.';}view('wiki-receipt');focusTitle('#cupids-main');return;}
  const newPage=hash.match(/^new(?:=(News|Trends))?$/);if(newPage){compose(null,newPage[1]||null);return;}
  const match=hash.match(/^(page|edit)=([A-Za-z0-9-]{1,60})$/);
  if(match){view('wiki-reader');$('#wiki-article').hidden=true;$('#wiki-read-error').hidden=false;$('#wiki-read-error').textContent='Opening this page…';
   try{const data=await W.request('/api/wiki/pages/'+match[2],undefined,'GET');if(generation!==routeGeneration)return;$('#wiki-read-error').hidden=true;if(match[1]==='edit')compose(data.page);else paintPage(data);}catch(error){if(generation!==routeGeneration)return;$('#wiki-read-error').textContent=error.message;}
   return;
  }
  document.title='Cupids’ Space — jeolee';view('wiki-index');await loadIndex();
 }
 $('#wiki-search-form').addEventListener('submit',event=>{event.preventDefault();rememberFilters();loadIndex();});$('#wiki-topic').addEventListener('change',()=>{rememberFilters();loadIndex();});$('#wiki-more').addEventListener('click',()=>loadIndex(true));$('#wiki-retry').addEventListener('click',()=>loadIndex());
 $('#wiki-form').addEventListener('input',()=>{dirty=true;drafts.set(draftKey,fields());persistDrafts();$('#wiki-reset-draft').hidden=false;});
 $('#wiki-reset-draft').addEventListener('click',()=>{if(confirm('Discard this unsent draft and start again?')){drafts.delete(draftKey);persistDrafts();dirty=false;route();}});
 $('#wiki-preview-toggle').addEventListener('click',()=>{const opening=$('#contribution-preview').hidden;$('#contribution-preview').hidden=!opening;$('#wiki-preview-toggle').setAttribute('aria-expanded',String(opening));if(opening)$('#contribution-preview').innerHTML=W.bodyHTML($('#contribution-body').value)||'<p>Your preview will appear here as you write.</p>';});
 $('#wiki-form').addEventListener('submit',async event=>{event.preventDefault();if(submitting)return;const payload=fields();if(!payload.sources.length||payload.sources.length>8){$('#wiki-form-error').textContent='Add between 1 and 8 source links.';return;}setBusy(true);$('#wiki-form-error').textContent='';
  try{await W.request('/api/wiki/proposals',payload);drafts.delete(draftKey);persistDrafts();S.save(receiptStorage,{title:payload.title,submittedAt:Date.now()});dirty=false;$('#wiki-form').reset();$('#receipt-message').textContent='“'+payload.title+'” is waiting for approval. Thank you for adding to the story.';location.hash='sent';}
  catch(error){$('#wiki-form-error').textContent=error.message;}finally{setBusy(false);}
 });
 window.addEventListener('beforeunload',event=>{if(drafts.size&&!draftStored){event.preventDefault();event.returnValue='';}});window.addEventListener('hashchange',route);const initial=new URL(location.href);$('#wiki-search').value=initial.searchParams.get('q')||'';const preset=initial.searchParams.get('topic');if([...$('#wiki-topic').options].some(o=>o.value===preset))$('#wiki-topic').value=preset;route();
})();

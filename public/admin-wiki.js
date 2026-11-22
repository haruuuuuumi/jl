'use strict';
(() => {
 const $=s=>document.querySelector(s),W=window.WikiUI;
 let status='pending',items=[],review=null,offset=0,sequence=0,active=false,loaded=false,busy=false;
 async function request(path,body,method){try{return await W.request(path,body,method);}catch(error){if([401,403].includes(error.status))window.dispatchEvent(new Event('admin:expired'));throw error;}}
 function selectArea(area){$('#clip-workspace').hidden=area!=='clips';$('#wiki-admin').hidden=area!=='wiki';document.querySelectorAll('[data-admin-area]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminArea===area)));if(area==='wiki'&&active&&!loaded)load();}
 async function load(more=false){
  if(!active)return;const current=++sequence;$('#wiki-admin-error').textContent='';$('#wiki-admin-results').textContent='Loading contributions…';$('#wiki-admin-more').disabled=true;
  try{const data=await request('/api/admin/wiki?'+new URLSearchParams({status,offset:String(more?offset:0)}),undefined,'GET');if(current!==sequence||!active)return;items=more?[...items,...data.items]:data.items;offset=items.length;loaded=true;
   for(const key of ['pending','pages','approved','rejected','trash'])$('#wiki-count-'+key).textContent=data.counts[key];$('#wiki-pending-badge').textContent=data.counts.pending?'('+data.counts.pending+' to review)':'';
   document.querySelectorAll('[data-wiki-status]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.wikiStatus===status)));$('#wiki-admin-results').textContent=items.length+' '+(['pages','trash'].includes(status)?'pages':'contributions')+(data.hasMore?' shown':'');$('#wiki-admin-more').hidden=!data.hasMore;
   $('#wiki-admin-rows').innerHTML=items.map(item=>`<article class="wiki-admin-row"><div><h2>${W.escape(item.title)}</h2><p>${W.escape(item.summary)}</p><p class="wiki-meta">${W.escape(item.topic)} · ${item.contributor?'By '+W.escape(item.contributor)+' (unverified nickname)': 'Version '+item.revision} · ${W.date(item.createdAt)}</p></div><div class="row-actions">${['pages','trash'].includes(status)?(status==='pages'?`<a href="/cupids#page=${encodeURIComponent(item.id)}" target="_blank" rel="noopener noreferrer">Read page</a><button data-wiki-page-action="archive" data-wiki-id="${W.escape(item.id)}" class="danger">Move to Trash</button>`:`<button data-wiki-page-action="restore" data-wiki-id="${W.escape(item.id)}">Restore page</button>`):`<button data-wiki-review="${W.escape(item.id)}">${status==='pending'?'Review contribution':'View contribution'}</button>`}</div></article>`).join('')||'<div class="admin-empty"><h2>Nothing waiting here.</h2><p>New pages and suggested edits will appear here for your review.</p></div>';
  }catch(error){if(current===sequence){$('#wiki-admin-error').textContent=error.message;$('#wiki-admin-results').textContent='';}}finally{if(current===sequence)$('#wiki-admin-more').disabled=false;}
 }
 async function openReview(id){
  $('#wiki-admin-error').textContent='';try{const data=await request('/api/admin/wiki/proposals/'+encodeURIComponent(id),undefined,'GET');if(!active)return;review=data;const p=data.proposal,c=data.current;
   $('#wiki-review-title').textContent=p.status==='pending'?'Review contribution':'Contribution record';$('#wiki-review-credit').textContent='By '+p.contributor+' (unverified nickname) · Submitted '+W.date(p.createdAt)+' · '+p.status;$('#wiki-review-change').textContent=p.changeNote;
   $('#wiki-current').innerHTML=c?`<p class="wiki-meta">Version ${c.revision}${c.deleted?' · In Trash':''}</p><h4>${W.escape(c.title)}</h4><p>${W.escape(c.summary)}</p><div class="wiki-prose">${W.bodyHTML(c.body)}</div><h4>Sources</h4>${W.sourcesHTML(c.sources)}`:'<p class="wiki-meta">This is a new page. Nothing is published yet.</p>';
   for(const [name,value] of Object.entries({title:p.title,summary:p.summary,topic:p.topic,body:p.body,sources:p.sources.join('\n'),note:p.reviewNote}))$('#review-wiki-'+name).value=value;
   $('#wiki-merge-wrap').hidden=!(c&&c.revision!==p.baseRevision);$('#wiki-merge-confirm').checked=false;$('#wiki-review-fields').disabled=p.status!=='pending';$('#wiki-review-actions').hidden=p.status!=='pending';$('#wiki-review-error').textContent='';$('#wiki-review-dialog').showModal();document.body.classList.add('dialog-open');
  }catch(error){$('#wiki-admin-error').textContent=error.message;}
 }
 function closeReview(){if($('#wiki-review-dialog').open)$('#wiki-review-dialog').close();}
 async function save(action){
  if(!review||busy)return;if(action!=='reject'&&!$('#wiki-review-form').reportValidity())return;busy=true;$('#wiki-review-actions').querySelectorAll('button').forEach(button=>button.disabled=true);$('#wiki-review-error').textContent='';const p=review.proposal,c=review.current;
  const payload={action,revision:p.revision,title:$('#review-wiki-title').value.trim(),summary:$('#review-wiki-summary').value.trim(),topic:$('#review-wiki-topic').value,body:$('#review-wiki-body').value.trim(),sources:$('#review-wiki-sources').value.split('\n').map(s=>s.trim()).filter(Boolean),reviewNote:$('#review-wiki-note').value.trim(),currentPageRevision:c?.revision||0,mergeConfirmed:$('#wiki-merge-confirm').checked};
  try{await request('/api/admin/wiki/proposals/'+encodeURIComponent(p.id),payload,'PATCH');closeReview();await load();if(typeof toast==='function')toast(action==='approve'?'Approved and published in Cupids’ Space.':action==='reject'?'Contribution rejected.':'Saved. This contribution is still waiting for approval.');}
  catch(error){$('#wiki-review-error').textContent=error.message;}finally{busy=false;$('#wiki-review-actions').querySelectorAll('button').forEach(button=>button.disabled=false);}
 }
 document.addEventListener('click',async event=>{
  const area=event.target.closest('[data-admin-area]');if(area){selectArea(area.dataset.adminArea);return;}
  const tab=event.target.closest('[data-wiki-status]');if(tab){status=tab.dataset.wikiStatus;load();return;}
  const item=event.target.closest('[data-wiki-review]');if(item){openReview(item.dataset.wikiReview);return;}
  const action=event.target.closest('[data-wiki-page-action]');if(action){const page=items.find(i=>i.id===action.dataset.wikiId);if(!page)return;action.disabled=true;try{await request('/api/admin/wiki/pages/'+encodeURIComponent(page.id),{action:action.dataset.wikiPageAction,revision:page.revision},'PATCH');await load();}catch(error){$('#wiki-admin-error').textContent=error.message;action.disabled=false;}}
 });
 $('#wiki-review-form').addEventListener('submit',event=>{event.preventDefault();save('approve');});$('#wiki-save-draft').addEventListener('click',()=>save('save'));$('#wiki-reject').addEventListener('click',()=>save('reject'));$('#wiki-review-close').addEventListener('click',closeReview);$('#wiki-admin-more').addEventListener('click',()=>load(true));$('#wiki-admin-refresh').addEventListener('click',()=>load());
 $('#wiki-review-dialog').addEventListener('close',()=>{review=null;$('#wiki-review-form').reset();$('#wiki-current').replaceChildren();document.body.classList.toggle('dialog-open',!!document.querySelector('dialog[open]'));});
 window.addEventListener('admin:ready',()=>{active=true;load();});window.addEventListener('admin:locked',()=>{active=false;sequence++;loaded=false;items=[];review=null;closeReview();$('#wiki-admin-rows').replaceChildren();$('#wiki-pending-badge').textContent='';$('#wiki-admin-error').textContent='';selectArea('clips');});
 if(!$('#admin-workspace').hidden){active=true;load();}
})();

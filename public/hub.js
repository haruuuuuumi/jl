'use strict';
(() => {
 const $=s=>document.querySelector(s),data=window.jeoleeHub,escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const arrow='<svg class="hub-link-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
 const date=value=>new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 let updates=[...data.updates],topics=[...data.topics],filter='all',generation=0,expanded=false;
 const chronological=(a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id);
 const linkAttributes=item=>item.kind==='community'?'':' target="_blank" rel="noopener noreferrer"';
 function render(){
  const visible=updates.filter(item=>filter==='all'||item.kind===filter).sort(chronological).slice(0,expanded?8:2);
  $('#hub-update-list').innerHTML=visible.map(item=>`<article class="hub-update">${item.image?`<img class="hub-news-image" src="${escape(item.image)}" alt="" width="900" height="390" loading="eager">`:''}<div class="hub-update-body"><div class="hub-item-meta"><span class="hub-news-label">${escape(item.label)}</span></div><h3><a href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.title)}</a></h3>${expanded?`<p class="hub-summary">${escape(item.summary)}</p>`:''}<a class="hub-source" href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.source)} · <time datetime="${escape(item.date)}">${date(item.date)}</time></a>${item.image&&expanded?'<p class="hub-image-caption">Illustration from the supplied fan photo collection.</p>':''}</div></article>`).join('');
  $('#hub-updates-empty').hidden=visible.length>0;
  $('#hub-feed-controls').hidden=!expanded;
  $('#hub-view-all').setAttribute('aria-expanded',String(expanded));$('#hub-view-all').innerHTML=(expanded?'Show highlights':'View all updates')+arrow;
  document.querySelectorAll('[data-hub-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.hubFilter===filter)));
  const displayTopics=expanded?[...topics].sort(chronological):[...topics.filter(item=>item.id!=='cupids')].sort(chronological).slice(0,2);
  $('#hub-topic-list').innerHTML=displayTopics.slice(0,5).map(item=>`<article class="hub-topic"><h3><a href="${escape(item.url)}"${linkAttributes(item)}><span>${escape(item.title)}</span>${arrow}</a></h3><p class="hub-item-meta"><time datetime="${escape(item.date)}">${date(item.date)}</time>${item.kind==='community'?' · Cupid contribution':''}</p>${expanded?`<p>${escape(item.summary)}</p><a class="hub-source" href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.source)}</a>`:''}</article>`).join('');
 }
 async function load(){
  const current=++generation;$('#hub-feed-error').hidden=true;
  const results=await Promise.allSettled(['News','Trends'].map(async topic=>{const response=await fetch('/api/wiki/pages?'+new URLSearchParams({topic}),{cache:'no-store'});if(!response.ok)throw new Error();return (await response.json()).pages;}));
  if(current!==generation)return;
  const toItem=page=>({id:'page-'+page.id,title:page.title,summary:page.summary,date:new Date(page.updatedAt).toISOString().slice(0,10),kind:'community',label:'Cupid contribution',source:'Read the approved page',url:'/cupids#page='+encodeURIComponent(page.id)});
  updates=[...data.updates,...(results[0].status==='fulfilled'?results[0].value.map(toItem):[])];topics=[...data.topics,...(results[1].status==='fulfilled'?results[1].value.map(toItem):[])];
  $('#hub-feed-error').hidden=results.every(result=>result.status==='fulfilled');render();
 }
 $('#hub-view-all').addEventListener('click',()=>{expanded=!expanded;if(!expanded)filter='all';render();});
 document.querySelectorAll('[data-hub-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.hubFilter;render();}));$('#hub-feed-retry').addEventListener('click',load);
 document.querySelectorAll('[data-profile]').forEach(link=>link.addEventListener('click',()=>{const target=document.getElementById(link.dataset.profile);if(target)target.open=true;}));
 render();load();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
})();

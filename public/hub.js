'use strict';
(() => {
 const $=s=>document.querySelector(s),data=window.jeoleeHub,escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=value=>new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(value.length===10?value+'T12:00:00Z':value));
 const track=$('#hub-update-list');
 let updates=[...data.updates],saved=[],community=[],topics=[...data.topics],filter='all',generation=0,expanded=false,scrollFrame=0;
 const chronological=(a,b)=>(b.createdAt||b.date).localeCompare(a.createdAt||a.date)||a.id.localeCompare(b.id);
 const linkAttributes=item=>item.kind==='community'?'':' target="_blank" rel="noopener noreferrer"';
 function carouselState(){
  const cards=[...track.children],last=track.scrollWidth-track.clientWidth;
  $('#hub-previous').disabled=track.scrollLeft<3;$('#hub-next').disabled=track.scrollLeft>=last-3;
  if(!cards.length){$('#hub-carousel-position').textContent='';return;}
  const edge=track.getBoundingClientRect(),visible=cards.map((card,i)=>({i,left:card.getBoundingClientRect().left,right:card.getBoundingClientRect().right})).filter(card=>card.right>edge.left+4&&card.left<edge.right-4);
  const label=visible.length?`${visible[0].i+1}–${visible.at(-1).i+1} of ${cards.length} updates`:'';if($('#hub-carousel-position').textContent!==label)$('#hub-carousel-position').textContent=label;
 }
 function render(){
  const visible=updates.filter(item=>filter==='all'||item.kind===filter).sort(chronological).slice(0,30);
  track.innerHTML=visible.map((item,index)=>`<article class="hub-update" role="group" aria-roledescription="slide" aria-label="${index+1} of ${visible.length}">${item.image?`<img class="hub-news-image" src="${escape(item.image)}" alt="" width="900" height="390" loading="${index<2?'eager':'lazy'}">`:''}<div class="hub-update-body"><div class="hub-item-meta"><span class="hub-news-label">${escape(item.label)}</span></div><h3><a href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.title)}</a></h3>${expanded?`<p class="hub-summary">${escape(item.summary)}</p>`:''}<a class="hub-source" href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.source)} · <time datetime="${escape(item.createdAt||item.date)}">${date(item.createdAt||item.date)}</time></a>${item.image&&expanded&&!item.imageFromPost?'<p class="hub-image-caption">Illustration from the supplied fan photo collection.</p>':''}</div></article>`).join('');
  track.querySelectorAll('img').forEach(image=>image.addEventListener('error',()=>{image.hidden=true;},{once:true}));
  track.scrollLeft=0;$('#hub-updates-empty').hidden=visible.length>0;
  $('#hub-carousel-controls').hidden=!visible.length;$('#hub-feed-controls').hidden=!expanded;
  $('#hub-view-all').setAttribute('aria-expanded',String(expanded));$('#hub-view-all').textContent=expanded?'Show highlights':'Browse updates';
  document.querySelectorAll('[data-hub-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.hubFilter===filter)));
  const displayTopics=expanded?[...topics].sort(chronological):[...topics.filter(item=>item.id!=='cupids')].sort(chronological).slice(0,2);
  $('#hub-topic-list').innerHTML=displayTopics.slice(0,5).map(item=>`<article class="hub-topic"><h3><a href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.title)}</a></h3><p class="hub-item-meta"><time datetime="${escape(item.date)}">${date(item.date)}</time>${item.kind==='community'?' · Cupid contribution':''}</p>${expanded?`<p>${escape(item.summary)}</p><a class="hub-source" href="${escape(item.url)}"${linkAttributes(item)}>${escape(item.source)}</a>`:''}</article>`).join('');
  requestAnimationFrame(carouselState);
 }
 async function load(){
  const current=++generation;$('#hub-feed-error').hidden=true;
  const paths=['/api/wiki/pages?topic=News','/api/wiki/pages?topic=Trends','/api/updates'];
  const results=await Promise.allSettled(paths.map(async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error();return response.json();}));
  if(current!==generation)return;
  const toItem=page=>({id:'page-'+page.id,title:page.title,summary:page.summary,date:new Date(page.updatedAt).toISOString().slice(0,10),kind:'community',label:'Cupid contribution',source:'Read the approved page',url:'/cupids#page='+encodeURIComponent(page.id)});
  if(results[0].status==='fulfilled')community=results[0].value.pages.map(toItem);
  if(results[1].status==='fulfilled')topics=[...data.topics,...results[1].value.pages.map(toItem)];
  const check=results[2],status=$('#hub-update-status');
  if(check.status==='fulfilled'){
   saved=check.value.items;status.textContent=check.value.lastCheckFailed?'Some fanbase posts couldn’t be checked. Showing the saved stories.':check.value.lastSuccessAt?'Last successful check: '+new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(check.value.lastSuccessAt)+' PHT.':'The first fanbase check is pending. Saved stories are shown below.';
  }else status.textContent='Update status is unavailable. Showing the saved stories.';
  const seen=new Set();updates=[...saved,...data.updates,...community].filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;});
  $('#hub-feed-error').hidden=results.slice(0,2).every(result=>result.status==='fulfilled');render();
 }
 $('#hub-view-all').addEventListener('click',()=>{expanded=!expanded;if(!expanded)filter='all';render();});
 document.querySelectorAll('[data-hub-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.hubFilter;render();}));$('#hub-feed-retry').addEventListener('click',load);
 const move=direction=>{const first=track.firstElementChild;if(first)track.scrollBy({left:direction*(first.getBoundingClientRect().width+18),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 $('#hub-previous').addEventListener('click',()=>move(-1));$('#hub-next').addEventListener('click',()=>move(1));
 track.addEventListener('keydown',event=>{if(event.target===track&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
 track.addEventListener('scroll',()=>{cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(carouselState);},{passive:true});new ResizeObserver(carouselState).observe(track);
 render();load();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
})();

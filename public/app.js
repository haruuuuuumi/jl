'use strict';
const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
let categories=[],categoryRecords=[];
const inCollection = (item,name) => item.category===name||item.collections?.includes(name);
const collectionLabel = item => category!=='all'&&inCollection(item,category)?category:item.category;
const parsePost = value => {
  try {
    const u = new URL(value.trim());
    if(!['https:','http:'].includes(u.protocol) || !['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(u.hostname.toLowerCase())) return null;
    const m = u.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d{10,25})(?:\/video\/([1-4]))?\/?$/);
    if(!m) return null;
    const mediaIndex=m[2]?Number(m[2]):null;
    const key=m[1]+(mediaIndex?'/video/'+mediaIndex:'');
    return {id:m[1],mediaIndex,key,url:'https://x.com'+u.pathname.split('/status/')[0]+'/status/'+key};
  } catch {return null;}
};
let items=[],libraryReady=false,libraryError='';
let category='all', query='', embedGeneration=0, toastTimer, widgetPromise=null;
const viewer=$('#viewer'),addDialog=$('#add-dialog');
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const videoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z"/></svg>';
const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
const photoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m4 16 5-5 4 4 3-3 4 4"/><circle cx="15" cy="8" r="1"/></svg>';
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function currentView(){return location.hash==='#collections'?'collections':'browse';}
function render(){
  const view=currentView();
  const home=view==='browse'&&!query;$('#hub-home').hidden=!home;$('#hub-library-heading').hidden=!home;
  $$('[data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const activeDestination=view==='collections'||query||location.hash==='#library'?'#library':location.hash==='#news'?'#news':'#browse';
  $$('.site-header nav a').forEach(a=>{if(a.getAttribute('href')===activeDestination)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#feature-stage').hidden=view!=='browse'||query.length>0;
  $('#category-filters').hidden=view==='collections';
  $('#collection-grid').hidden=view!=='collections';
  $('#clip-grid').hidden=view==='collections';
  $('#empty-state').hidden=true;
  $$('.header-actions .add-trigger').forEach(b=>b.disabled=!libraryReady);
  if(!libraryReady){$('#empty-action').classList.remove('add-trigger');$('#empty-action').disabled=false;$('#feature-stage').hidden=true;$('#category-filters').hidden=true;$('#collection-grid').hidden=true;$('#clip-grid').hidden=true;$('#library-title').textContent='Your next replay is on its way.';$('#library-caption').textContent='';$('#results-note').textContent='';$('#empty-state').hidden=false;$('#empty-title').textContent=libraryError?'The collection couldn’t load.':'Getting the collection ready.';$('#empty-description').textContent=libraryError||'Just a moment…';$('#empty-action').hidden=!libraryError;$('#empty-action').textContent='Try again';return;}
  $('#empty-action').hidden=false;
  $('#library-title').innerHTML=view==='collections'?'A collection for every mood<span>.</span>':query?'Find your moment<span>.</span>':'Pick your kind of kilig<span>.</span>';
  $('#library-caption').textContent=view==='collections'?'a little something for every feeling.':'the moments we keep coming back to.';
  if(view==='collections'){
    $('#results-note').textContent='';
    const covers=Object.fromEntries(categories.map(c=>[c,items.find(v=>inCollection(v,c)&&v.kind==='clip'&&v.image)?.image||'assets/together.png']));
    $('#collection-grid').innerHTML=categories.map((c,i)=>{const count=items.filter(v=>inCollection(v,c)).length;return `<button class="collection-tile" data-collection="${esc(c)}"><img src="${esc(covers[c]||'assets/together.png')}" alt="" loading="lazy"><div><h3>${esc(c)}</h3><p>${count?`${count} ${count===1?'moment':'moments'}`:'Ready for a new moment'}</p></div></button>`;}).join('');
  }else{
    const filtered=items.filter(v=>(category==='all'||inCollection(v,category))&&(!query||(v.title+' '+v.category+' '+(v.collections||[]).join(' ')+' '+v.kind+' '+(v.duration||'')+' '+(v.creator?.handle||'')+' '+(v.creator?.name||'')).toLowerCase().includes(query)));
    $('#results-note').textContent=query?`${filtered.length} ${filtered.length===1?'result':'results'} for “${$('#search-input').value.trim()}”`:'';
    $('#clip-grid').innerHTML=filtered.map(v=>`<article class="moment"><button class="moment-art" data-open="${esc(v.id)}" aria-label="${v.kind==='clip'?(v.mediaIndex>1?'Open post preview:':v.duration?'Play video:':'Open X post:'):'Open photo:'} ${esc(v.title)}"><img src="${esc(v.image)}" alt="" loading="lazy"><span class="media-mark">${v.kind==='clip'?(v.mediaIndex>1?'Post preview':v.duration?'Video':'X post'):'Photo'}</span>${v.duration?`<span class="duration">${esc(v.duration)}</span>`:''}<span class="round-play" aria-hidden="true">${v.kind==='clip'?(v.duration?videoIcon:playIcon):photoIcon}</span></button><button class="moment-name" data-open="${esc(v.id)}">${esc(v.title)}</button><p class="moment-caption">${v.creator?`@${esc(v.creator.handle)} · `:''}${v.mediaIndex?`Part ${v.mediaIndex} · `:''}${esc(collectionLabel(v))}${v.custom?' · Added by you':''}</p></article>`).join('');
    if(!filtered.length){
      $('#empty-state').hidden=false;
      $('#empty-title').textContent=query?'That moment is still out there.':'A little room for more.';
      $('#empty-description').textContent=query?'Try a different title or collection.':'Add an X clip to start this collection.';
      $('#empty-action').textContent=query?'Clear search':'Submit a clip';
      $('#empty-action').classList.toggle('add-trigger',!query&&libraryReady);
    }
  }
  $$('[data-filter]').forEach(b=>{const on=b.dataset.filter===category;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
function stopVideo(){
  // Removing the iframe stops the embedded player, including its audio.
  $('#viewer-media').replaceChildren();
}
function renderCreator(item){
  const row=$('#creator-header');row.replaceChildren();row.hidden=!item.creator;
  if(!item.creator)return;
  const identity=document.createElement('a');identity.className='creator-identity';identity.href='https://x.com/'+item.creator.handle;identity.target='_blank';identity.rel='noopener noreferrer';
  if(item.creator.avatar){const avatar=document.createElement('img');avatar.src=item.creator.avatar;avatar.alt='';avatar.width=40;avatar.height=40;avatar.addEventListener('error',()=>avatar.remove(),{once:true});identity.append(avatar);}
  const names=document.createElement('span'),name=document.createElement('strong'),handle=document.createElement('span');name.textContent=item.creator.name;handle.textContent='@'+item.creator.handle;names.append(name,handle);identity.append(names);
  const source=document.createElement('a');source.className='creator-source';source.href=item.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=item.mediaIndex>1?'Open part '+item.mediaIndex+' on X':'View on X';source.setAttribute('aria-label','View original post by @'+item.creator.handle+' on X');row.append(identity,source);
}
function videoFallback(item,message){
  const area=$('#viewer-media');area.replaceChildren();
  const box=document.createElement('div');box.className='embed-fallback';
  const text=document.createElement('p');text.className='embed-status';text.setAttribute('role','status');text.textContent=message;
  const link=document.createElement('a');link.className='button button-red';link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open on X';
  const retry=document.createElement('button');retry.className='text-button';retry.textContent='Try again';retry.addEventListener('click',()=>playVideo(item));box.append(text,link);if(item.id!=='first-replay')box.append(retry);area.append(box);
}
function loadWidgets(){
  if(window.twttr?.widgets?.createTweet)return Promise.resolve(window.twttr);
  if(widgetPromise)return widgetPromise;
  widgetPromise=new Promise((resolve,reject)=>{
    let complete=false;
    const fail=()=>{if(complete)return;complete=true;clearTimeout(timer);widgetPromise=null;reject(new Error('The X player could not load.'));};
    const ready=()=>{if(complete)return;if(window.twttr?.widgets?.createTweet){complete=true;clearTimeout(timer);resolve(window.twttr);}else if(window.twttr?.ready)window.twttr.ready(ready);else fail();};
    const timer=setTimeout(fail,15000);
    $('#x-widgets-script')?.remove();
    const script=document.createElement('script');script.id='x-widgets-script';script.src='https://platform.twitter.com/widgets.js';script.async=true;script.onload=ready;script.onerror=fail;document.head.append(script);
  });return widgetPromise;
}
async function playVideo(item){
  stopVideo();const generation=++embedGeneration,area=$('#viewer-media');
  renderCreator(item);
  if(item.id==='first-replay'){
    videoFallback(item,'This is the introduction to the thread. Browse the individual videos in Just Jeolee, or open the thread on X.');return;
  }
  const loading=document.createElement('p');loading.className='embed-status';loading.setAttribute('role','status');loading.textContent='Loading this moment…';area.append(loading);
  const target=document.createElement('div');target.className='x-video-embed';area.append(target);
  let expire;
  try{
    // Let X negotiate its playback stream. Direct MP4 links can reject playback requests.
    const twitter=await loadWidgets();if(generation!==embedGeneration)return;
    const result=await Promise.race([
      twitter.widgets.createTweet(parsePost(item.url).id,target,{theme:'dark',dnt:true,conversation:'none',width:550,mediaMaxWidth:800,align:'center'}),
      new Promise((_,reject)=>{expire=setTimeout(()=>reject(new Error('The X player took too long to load.')),20000);})
    ]);
    clearTimeout(expire);if(generation!==embedGeneration){target.remove();return;}
    if(!result)throw new Error('This video is unavailable in the X player.');
    loading.remove();
    result.title=item.title+' — video player';
  }catch(error){clearTimeout(expire);if(generation!==embedGeneration)return;target.remove();videoFallback(item,error.message||'The X player could not load. Please try again.');}
}
function syncDialogLock(){document.body.classList.toggle('dialog-open',viewer.open||addDialog.open);}
function openItem(id){
  const item=items.find(v=>v.id===id);if(!item)return;
  $('#viewer-title').textContent=item.title+(item.mediaIndex>1?' — post preview':'');$('#viewer-description').textContent=item.description||(item.kind==='clip'?(item.mediaCount>1?'This X post has '+item.mediaCount+' videos. Its embedded player starts with part 1.'+(item.mediaIndex>1?' Use the original part '+item.mediaIndex+' link above for this specific clip.':''):item.custom?'Added by you.':''):'A photo from the Jeolee collection.');
  $('#viewer-type').textContent=item.mediaIndex>1?collectionLabel(item)+' · X post preview':collectionLabel(item)+' · '+(item.kind==='clip'?(item.duration?'Video':'X post'):'Photo')+(item.duration?' · '+item.duration:'');
  $('#source-link').hidden=item.kind!=='clip';$('#source-link').href=item.url||'#';$('#source-link').textContent=item.mediaIndex?'Open video '+item.mediaIndex+' on X':'View original on X';
  if(!viewer.open)viewer.showModal();syncDialogLock();
  if(item.kind==='clip')playVideo(item);else{embedGeneration++;stopVideo();$('#creator-header').hidden=true;const image=document.createElement('img');image.src=item.image;image.alt=item.title+' — Jeo and Gehlee';$('#viewer-media').replaceChildren(image);}
}
function openAdd(){if(viewer.open)viewer.close();$('#add-error').textContent='';if(!addDialog.open)addDialog.showModal();syncDialogLock();}
document.addEventListener('click',event=>{
  const open=event.target.closest('[data-open]');if(open){openItem(open.dataset.open);return;}
  const filter=event.target.closest('[data-filter]');if(filter){category=filter.dataset.filter;render();return;}
  const collection=event.target.closest('[data-collection]');if(collection){category=collection.dataset.collection;if(currentView()!=='browse')location.hash='browse';else render();$('#library').scrollIntoView({behavior:'smooth'});return;}
  const nav=event.target.closest('[data-view]');if(nav){event.preventDefault();category='all';query='';$('#search-input').value='';if(currentView()===nav.dataset.view){render();window.scrollTo({top:0,behavior:'smooth'});}else location.hash=nav.dataset.view;return;}
  if(event.target.closest('.add-trigger')){openAdd();return;}
});
$('#empty-action').addEventListener('click',()=>{if(!libraryReady){loadSharedCatalog();return;}if(query){query='';$('#search-input').value='';render();$('#search-input').focus();}});
$('.close-viewer').addEventListener('click',()=>viewer.close());$('#close-add').addEventListener('click',()=>addDialog.close());
for(const dialog of [viewer,addDialog]){dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(dialog===viewer){embedGeneration++;stopVideo();$('#creator-header').replaceChildren();}syncDialogLock();});}
$('#add-form').addEventListener('submit',async event=>{
  event.preventDefault();const post=parsePost($('#clip-url').value),title=$('#clip-title').value.trim();
  if(!post){$('#add-error').textContent='Paste a full X video post link, including /status/ and the post number.';return;}
  if(!title){$('#add-error').textContent='Give this moment a name first.';return;}
  const submit=$('#add-form button[type="submit"]');submit.disabled=true;submit.textContent='Submitting…';$('#add-error').textContent='';
  try{
    const response=await fetch('/api/submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:post.url,title,categoryId:$('#clip-category').value})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'This clip could not be submitted.');
    $('#add-form').reset();addDialog.close();notify('Submitted for review. It will appear after approval.');
  }catch(error){$('#add-error').textContent=error.message||'This clip could not be submitted. Please try again.';}
  finally{submit.disabled=false;submit.textContent='Submit for review';}
});
$('#search-toggle').addEventListener('click',()=>{const opening=$('#search-panel').hidden;$('#search-panel').hidden=!opening;$('#search-toggle').setAttribute('aria-expanded',String(opening));if(opening)$('#search-input').focus();});
$('#search-close').addEventListener('click',()=>{$('#search-panel').hidden=true;$('#search-toggle').setAttribute('aria-expanded','false');query='';$('#search-input').value='';render();$('#search-toggle').focus();});
$('#search-panel').addEventListener('submit',e=>e.preventDefault());$('#search-input').addEventListener('input',()=>{query=$('#search-input').value.trim().toLowerCase();if(currentView()==='collections')location.hash='browse';else render();});
function scrollToView(){const target=document.getElementById(location.hash.slice(1));const behavior=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';if(target)target.scrollIntoView({behavior,block:'start'});else window.scrollTo({top:0,behavior});}
window.addEventListener('hashchange',()=>{render();scrollToView();});
async function loadSharedCatalog(quiet=false){
  if(!quiet){libraryError='';render();}
  try{
    const response=await fetch('/api/catalog',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');
    categoryRecords=data.categories;categories=categoryRecords.map(c=>c.name);items=data.items;
    if(category!=='all'&&!categories.includes(category))category='all';
    $('#category-filters').innerHTML=[{name:'All moments',value:'all'},...categories.map(name=>({name,value:name}))].map(c=>`<button class="filter" data-filter="${esc(c.value)}" aria-pressed="false">${esc(c.name)}</button>`).join('');
    $('#clip-category').replaceChildren(...categoryRecords.map(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=c.name;return option;}));
    libraryReady=true;libraryError='';syncFeaturedItems();render();if(!quiet&&location.hash)requestAnimationFrame(scrollToView);
  }catch(error){if(!libraryReady){libraryError='Please refresh or try again in a moment.';render();}else if(!quiet)notify('The collection couldn’t refresh. Please try again.');}
}
function syncFeaturedItems(){
  const clips=items.filter(v=>v.kind==='clip'&&v.duration);let fallback=0;
  $$('#feature-stage [data-open]').forEach(button=>{
    let item=items.find(v=>v.id===button.dataset.open);if(!item)item=clips[fallback++%Math.max(clips.length,1)];
    button.hidden=!item;if(!item)return;button.dataset.open=item.id;
    if(button.classList.contains('side-feature')){button.setAttribute('aria-label','Play '+item.title);$('.side-title',button).innerHTML=esc(item.title.toLowerCase())+'<span class="short-rule"></span>';$('.media-mark',button).textContent=(item.duration?item.duration+' · ':'')+'Video';$('img',button).src=item.image;}
  });
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!viewer.open&&!addDialog.open&&libraryReady)loadSharedCatalog(true);});
loadSharedCatalog();

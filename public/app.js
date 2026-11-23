'use strict';
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)],S=window.SiteUI,esc=value=>S.escape(value);
const inCollection=(item,name)=>item.category===name||item.collections?.includes(name),collectionLabel=item=>category!=='all'&&inCollection(item,category)?category:item.category;
const parsePost=value=>{try{const u=new URL(value.trim());if(!['https:','http:'].includes(u.protocol)||!['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(u.hostname.toLowerCase()))return null;const m=u.pathname.match(/^\/([A-Za-z0-9_]+|i\/web)\/status\/(\d{10,25})(?:\/video\/([1-4]))?\/?$/);return m?{id:m[2],mediaIndex:m[3]?Number(m[3]):null,url:'https://x.com'+u.pathname}:null;}catch{return null;}};
const openingClip={"id":"where-it-all-started","title":"Where it all started","url":"https://x.com/4gehlee/status/2124429659014393945","kind":"clip","category":"Featured","creator":{"name":"4gehlee","handle":"4gehlee"}};
const findMoment=id=>id===openingClip.id?openingClip:items.find(item=>item.id===id);
let items=[],categoryRecords=[],category='all',query='',libraryReady=false,libraryError='',shown=24,embedGeneration=0,toastTimer,widgetPromise=null,searchTimer,viewerReturn=null,addReturn=null,routeClosing=false,openedId='';
const viewer=$('#viewer'),addDialog=$('#add-dialog'),draftKey='jeolee:clip-draft:v2',receiptKey='jeolee:clip-receipt:v2';
const videoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z"/></svg>',playIcon=videoIcon,photoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m4 16 5-5 4 4 3-3 4 4"/></svg>';
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function route(){const url=new URL(location.href),record=categoryRecords.find(c=>c.id===url.searchParams.get('collection')||c.name===url.searchParams.get('collection'));category=record?.name||'all';query=(url.searchParams.get('q')||'').slice(0,100);$('#search-input').value=query;
 for(const key of ['from','to','order'])$('#clip-'+key).value=url.searchParams.get(key)||'';
 shown=24;render();const id=url.searchParams.get('clip');if(id&&(libraryReady||id===openingClip.id)){if(findMoment(id)){if(openedId!==id)openItem(id,false);}else notify('This moment is no longer in the published collection.');}else if(viewer.open){routeClosing=true;viewer.close();routeClosing=false;}}
function setRoute(replace=false){const url=new URL(location.href);const record=categoryRecords.find(c=>c.name===category);if(record)url.searchParams.set('collection',record.id);else url.searchParams.delete('collection');if(query)url.searchParams.set('q',query);else url.searchParams.delete('q');for(const key of ['from','to','order']){
 const value=$('#clip-'+key).value;
 if(value)url.searchParams.set(key,value);
 else url.searchParams.delete(key);
 }
 url.searchParams.delete('clip');url.searchParams.delete('submit');url.hash='';history[replace?'replaceState':'pushState'](null,'',url);shown=24;render();}
function render(){
 $('#red-string-credit').hidden=category!=='Red String Theory'||!libraryReady;
 $('#feature-stage').hidden=!!query||category!=='all'||!libraryReady;
 $$('.add-trigger').forEach(button=>button.disabled=!libraryReady);
 if(!libraryReady){$('#clip-grid').replaceChildren();$('#library-more').hidden=true;$('#category-filters').hidden=true;$('#results-note').textContent='';$('#empty-state').hidden=false;$('#empty-title').textContent=libraryError?'The collection couldn’t load.':'Getting the collection ready.';$('#empty-description').textContent=libraryError||'Just a moment…';$('#empty-action').hidden=!libraryError;$('#empty-action').textContent='Try again';return;}
 $('#category-filters').hidden=false;
 const lower=query.toLowerCase(),filtered=items.filter(item=>(category==='all'||inCollection(item,category))&&(!query||(item.title+' '+item.category+' '+(item.collections||[]).join(' ')+' '+(item.creator?.handle||'')+' '+(item.creator?.name||'')).toLowerCase().includes(lower)));
 const dated=S.filterDates(filtered,item=>item.postedAt,{from:$('#clip-from').value,to:$('#clip-to').value,order:$('#clip-order').value});
 const visible=dated.slice(0,shown);
 $('#library-title').textContent=query?'Find your moment.':category==='all'?'Pick your kind of kilig.':category;
 $('#results-note').textContent='Showing '+visible.length+' of '+dated.length+' '+(dated.length===1?'moment':'moments')+(query?' for “'+query+'”':'');
 $('#clip-grid').innerHTML=visible.map(item=>{const label=item.kind==='photo'?'Photo':item.mediaIndex>1?'X post preview':item.duration?'Video':'X post';return '<article class="moment"><button class="moment-open" data-open="'+esc(item.id)+'" aria-label="'+esc((item.kind==='photo'?'Open photo: ':item.mediaIndex>1?'Open post preview: ':item.duration?'Play video: ':'Open X post: ')+item.title)+'"><span class="moment-art">'+S.picture(item.image,'')+'<span class="media-mark">'+label+'</span>'+(item.duration?'<span class="duration">'+esc(item.duration)+'</span>':'')+'<span class="round-play" aria-hidden="true">'+(item.kind==='photo'?photoIcon:videoIcon)+'</span></span><span class="moment-name">'+esc(item.title)+'</span></button><p class="moment-caption">'+(item.creator?'@'+esc(item.creator.handle)+' · ':'')+(item.mediaIndex?'Part '+item.mediaIndex+' · ':'')+esc(collectionLabel(item))+(item.postedAt?' · Posted '+S.date(item.postedAt):'')+'</p></article>';}).join('');
 $('#library-more').hidden=visible.length>=dated.length;$('#empty-state').hidden=dated.length>0;$('#empty-action').hidden=false;$('#empty-title').textContent='That moment is still out there.';$('#empty-description').textContent='Try another title, creator, collection, or date range.';$('#empty-action').textContent='Show all moments';
 $$('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===category)));S.onImageError($('#clip-grid'));
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

function openItem(id,changeURL=true){
 const item=findMoment(id);if(!item)return;viewerReturn=document.activeElement;openedId=id;
 if(changeURL){const url=new URL(location.href);url.searchParams.set('clip',id);history.pushState({momentViewer:true},'',url);}
 $('#viewer-title').textContent=item.title+(item.mediaIndex>1?' — post preview':'');$('#viewer-description').textContent=item.description||(item.mediaCount>1?'This post has '+item.mediaCount+' videos. X’s embedded player starts with part 1; the original link opens the selected part.':item.kind==='photo'?'A photo from the Jeolee collection.':'');
 $('#viewer-type').textContent=collectionLabel(item)+' · '+(item.kind==='photo'?'Photo':item.mediaIndex>1?'X post preview':'Video')+(item.duration?' · '+item.duration:'');
 $('#source-link').hidden=item.kind!=='clip';$('#source-link').href=item.url||'#';$('#source-link').textContent=item.mediaIndex?'Open video '+item.mediaIndex+' on X':'View original on X';
 $('#moment-link').value=new URL('/moments?clip='+encodeURIComponent(id),location.origin).href;$('#moment-link').hidden=true;
 if(!viewer.open)viewer.showModal();syncDialogLock();
 if(item.kind==='clip')playVideo(item);else{embedGeneration++;stopVideo();$('#creator-header').hidden=true;const image=document.createElement('img');image.src=item.image;image.alt=item.title+' — Jeo and Gehlee';$('#viewer-media').replaceChildren(image);}
}
function receipt(value){$('#clip-receipt').hidden=!value;if(value)$('#clip-receipt-detail').textContent='“'+value.title+'” · '+value.collection+' · Submitted '+S.date(value.submittedAt,true)+' PHT.';}
function setDefaultClipDate(){
 const field=$('#clip-date');
 field.max=S.day(Date.now());
 field.value=field.max;
}
function draftFields(){return {clipDate:$('#clip-date').value,url:$('#clip-url').value,title:$('#clip-title').value,category:$('#clip-category').value,suggestedCategory:$('#clip-new-category').value};}
function saveDraft(){const value=draftFields(),hasContent=!!(value.url.trim()||value.title.trim()||value.suggestedCategory.trim()||(value.clipDate&&value.clipDate!==S.day(Date.now())));if(!hasContent){S.remove(draftKey);$('#clip-draft-status').textContent='Unsent details are saved on this device.';$('#discard-clip-draft').hidden=true;return;}const saved=S.save(draftKey,value);$('#clip-draft-status').textContent=saved?'Draft saved on this device.':'Draft saving is unavailable. Keep this tab open until you submit.';$('#discard-clip-draft').hidden=false;}
function restoreDraft(){const draft=S.read(draftKey);if(!draft)return false;if(draft.clipDate)$('#clip-date').value=draft.clipDate;$('#clip-url').value=draft.url||'';$('#clip-title').value=draft.title||'';if([...$('#clip-category').options].some(option=>option.value===draft.category))$('#clip-category').value=draft.category;$('#clip-new-category').value=draft.suggestedCategory||'';syncCategorySuggestion();$('#clip-draft-status').textContent='Your saved draft is back.';$('#discard-clip-draft').hidden=false;return true;}
function openAdd(){addReturn=document.activeElement;if(viewer.open)viewer.close();$('#add-error').textContent='';setDefaultClipDate();const draft=restoreDraft(),last=S.read(receiptKey);receipt(last);$('#add-form').hidden=!!last&&!draft;if(!addDialog.open)addDialog.showModal();syncDialogLock();}
function syncCategorySuggestion(focus=false){const suggesting=$('#clip-category').value==='__suggest_new__';$('#clip-suggestion').hidden=!suggesting;$('#clip-new-category').disabled=!suggesting;$('#clip-new-category').required=suggesting;if(suggesting&&focus)$('#clip-new-category').focus();}
document.addEventListener('click',event=>{const open=event.target.closest('[data-open]');if(open){openItem(open.dataset.open);return;}const filter=event.target.closest('[data-filter]');if(filter){category=filter.dataset.filter;setRoute();return;}if(event.target.closest('.add-trigger'))openAdd();});
$('#library-more').addEventListener('click',()=>{const before=$$('#clip-grid .moment').length;shown+=24;render();const next=$$('#clip-grid .moment-open')[before];next?.focus({preventScroll:true});});
$('#empty-action').addEventListener('click',()=>{if(!libraryReady)loadSharedCatalog();else{query='';category='all';$('#search-input').value='';for(const key of ['from','to','order'])$('#clip-'+key).value='';setRoute();}});
$('.close-viewer').addEventListener('click',()=>viewer.close());$('#close-add').addEventListener('click',()=>addDialog.close());
for(const dialog of [viewer,addDialog]){dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(dialog===viewer){embedGeneration++;stopVideo();$('#creator-header').replaceChildren();openedId='';if(!routeClosing&&new URL(location.href).searchParams.has('clip')){if(history.state?.momentViewer)history.back();else{const url=new URL(location.href);url.searchParams.delete('clip');history.replaceState(null,'',url);}}if(viewerReturn?.isConnected)viewerReturn.focus({preventScroll:true});}else if(addReturn?.isConnected)addReturn.focus({preventScroll:true});syncDialogLock();});}
$('#copy-moment-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#moment-link').value);notify('Moment link copied.');}catch{$('#moment-link').hidden=false;$('#moment-link').focus();$('#moment-link').select();notify('Copy the selected moment link.');}});
$('#clip-category').addEventListener('change',()=>{syncCategorySuggestion(true);saveDraft();});$('#add-form').addEventListener('input',saveDraft);
$('#discard-clip-draft').addEventListener('click',()=>{if(confirm('Discard this unsent clip draft?')){$('#add-form').reset();setDefaultClipDate();syncCategorySuggestion();S.remove(draftKey);saveDraft();}});
$('#clip-submit-another').addEventListener('click',()=>{$('#clip-receipt').hidden=true;$('#add-form').hidden=false;$('#clip-url').focus();});
$('#add-form').addEventListener('submit',async event=>{event.preventDefault();const post=parsePost($('#clip-url').value),title=$('#clip-title').value.trim();if(!post){$('#add-error').textContent='Paste a complete X video post link.';return;}if(!title){$('#add-error').textContent='Give this moment a name.';return;}const suggesting=$('#clip-category').value==='__suggest_new__',suggestedCategory=$('#clip-new-category').value.trim();if(suggesting&&!suggestedCategory){$('#add-error').textContent='Give your suggested collection a name.';return;}
 const submit=$('#add-form button[type=submit]');submit.disabled=true;submit.textContent='Submitting…';$('#add-error').textContent='';
 try{const response=await fetch('/api/submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:post.url,title,clipDate:$('#clip-date').value||S.day(Date.now()),...(suggesting?{suggestedCategory}:{categoryId:$('#clip-category').value})})}),result=await response.json();if(!response.ok)throw Error(result.error||'This clip could not be submitted.');
 const value={title,collection:suggesting?'Suggested collection: '+suggestedCategory:$('#clip-category').selectedOptions[0].textContent,submittedAt:Date.now(),reference:result.id};S.save(receiptKey,value);S.remove(draftKey);$('#add-form').reset();setDefaultClipDate();syncCategorySuggestion();saveDraft();$('#add-form').hidden=true;receipt(value);$('#clip-submit-another').focus();notify('Submitted for review.');
 }catch(error){$('#add-error').textContent=error.message||'Please try again. Your draft is saved.';}finally{submit.disabled=false;submit.textContent='Submit for review';}});
$('#search-panel').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);query=$('#search-input').value.trim().slice(0,100);setRoute(true);});
$('#search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=$('#search-input').value.trim().slice(0,100);setRoute(true);},160);});
$('#search-close').addEventListener('click',()=>{clearTimeout(searchTimer);query='';$('#search-input').value='';setRoute();$('#search-input').focus();});
$('#clip-dates').addEventListener('change',()=>setRoute());
window.addEventListener('popstate',route);
async function loadSharedCatalog(quiet=false){if(!quiet){libraryError='';render();}try{const response=await fetch('/api/catalog',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error();items=data.items;categoryRecords=data.categories;$('#category-filters').innerHTML=[{name:'All moments',value:'all'},...categoryRecords.map(c=>({name:c.name,value:c.name}))].map(c=>'<button class="filter" data-filter="'+esc(c.value)+'" aria-pressed="false">'+esc(c.name)+'</button>').join('');
 const selected=$('#clip-category').value;$('#clip-category').replaceChildren(...[...categoryRecords,{id:'__suggest_new__',name:'Suggest a new category'}].map(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=c.name;return option;}));if([...$('#clip-category').options].some(o=>o.value===selected))$('#clip-category').value=selected;
 libraryReady=true;libraryError='';syncCategorySuggestion();$$('[data-feature]').forEach((button,i)=>{const item=items.find(v=>v.id===button.dataset.open)||items.filter(v=>v.kind==='clip'&&v.duration&&!(v.mediaIndex>1))[i];button.hidden=!item;if(item){button.dataset.open=item.id;button.setAttribute('aria-label','Play '+item.title);$('img',button).src=item.image;$('.featured-title',button).innerHTML=esc(item.title)+'<small>'+esc(item.duration||'X post')+'</small>';}});
 route();if(new URL(location.href).searchParams.has('submit')){const url=new URL(location.href);url.searchParams.delete('submit');history.replaceState(null,'',url);openAdd();}
 }catch{if(!libraryReady){libraryError='Please try again. Other pages are still available from the menu.';render();}else if(!quiet)notify('The collection couldn’t refresh. Your current moments are still here.');}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!viewer.open&&!addDialog.open&&libraryReady)loadSharedCatalog(true);});
loadSharedCatalog();

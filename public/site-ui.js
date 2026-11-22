'use strict';
window.SiteUI={
 escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 read(key,fallback=null){try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}},
 save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},
 remove(key){try{localStorage.removeItem(key);}catch{}},
 date(value,withTime=false){return new Intl.DateTimeFormat('en',{dateStyle:'medium',...(withTime?{timeStyle:'short'}:{}),timeZone:'Asia/Manila'}).format(new Date(typeof value==='string'&&value.length===10?value+'T12:00:00Z':value));},
 day(value){
  return new Date(value+8*60*60*1000).toISOString().slice(0,10);
 },
 filterDates(items, timestamp, {from,to,order}){
  const visible=items.filter(item=>{
   if(!from&&!to)return true;
   const stamp=timestamp(item);
   if(!Number.isFinite(stamp))return false;
   const day=this.day(stamp);
   return (!from||day>=from)&&(!to||day<=to);
  });
  if(order==='newest'||order==='oldest'){
   visible.sort((a,b)=>{
    const left=timestamp(a),right=timestamp(b);
    if(!Number.isFinite(left))return Number.isFinite(right)?1:0;
    if(!Number.isFinite(right))return -1;
    return order==='newest'?right-left:left-right;
   });
  }
  return visible;
 },
 picture(src,alt='',className='',priority=false){
  const e=this.escape,match=String(src||'').match(/(?:^|\/)assets\/(little-things|together)\.png$/),attrs=' class="'+e(className)+'" alt="'+e(alt)+'" loading="'+(priority?'eager':'lazy')+'"'+(priority?' fetchpriority="high"':'')+' decoding="async"';
  if(!match)return '<img src="'+e(src)+'"'+attrs+'>';
  const name=match[1],set=format=>[480,960,1280].map(w=>'/assets/optimized/'+name+'-'+w+'.'+format+' '+w+'w').join(', ');
  return '<picture><source type="image/avif" srcset="'+set('avif')+'" sizes="(max-width:700px) 92vw, 50vw"><source type="image/webp" srcset="'+set('webp')+'" sizes="(max-width:700px) 92vw, 50vw"><img src="/assets/optimized/'+name+'-960.webp"'+attrs+' width="1280" height="'+(name==='together'?'821':'911')+'"></picture>';
 },
 newsCard(item,{compact=false,slide=null}={}){
  const e=this.escape,external=item.kind!=='community'?' target="_blank" rel="noopener noreferrer"':'',stamp=item.createdAt||item.date;
  return '<article class="hub-update"'+(slide?' role="group" aria-roledescription="slide" aria-label="'+e(slide)+'"':'')+'>'+(item.image?this.picture(item.image,'','hub-news-image'):'')+'<div class="hub-update-body"><p class="hub-item-meta"><span class="hub-news-label">'+e(item.label)+'</span></p><h3><a href="'+e(item.url)+'"'+external+'>'+e(item.title)+'</a></h3>'+(!compact?'<p class="hub-summary">'+e(item.summary)+'</p>':'')+'<a class="hub-source" href="'+e(item.url)+'"'+external+'>'+e(item.source)+' · '+(item.kind==='community'?'Approved ':'')+'<time datetime="'+e(stamp)+'">'+this.date(stamp)+'</time></a>'+(item.image&&!item.imageFromPost?'<p class="hub-image-caption">Illustrative fan photograph.</p>':'')+'</div></article>';
 },
 mergeUpdates(...groups){const seen=new Set();return groups.flat().filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).sort((a,b)=>(b.createdAt||b.date).localeCompare(a.createdAt||a.date)||a.id.localeCompare(b.id));},
 pageUpdate(page){return {id:'page-'+page.id,title:page.title,summary:page.summary,date:new Date(page.updatedAt).toISOString().slice(0,10),createdAt:new Date(page.updatedAt).toISOString(),kind:'community',label:'Cupid contribution',source:'Read the approved page',url:'/cupids#page='+encodeURIComponent(page.id)};},
 onImageError(root){root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(!img.closest('.moment-art'))(img.closest('picture')||img).hidden=true;},{once:true}));}
};
(() => {
 const menu=document.querySelector('.menu-toggle'),header=document.querySelector('.site-header'),nav=document.querySelector('#site-navigation');
 const close=()=>{header?.classList.remove('nav-open');menu?.setAttribute('aria-expanded','false');};
 menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';header.classList.toggle('nav-open',open);menu.setAttribute('aria-expanded',String(open));});
 nav?.addEventListener('click',event=>{if(event.target.closest('a'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){const wasOpen=header?.classList.contains('nav-open');close();document.querySelectorAll('.contribute-menu[open]').forEach(el=>el.open=false);if(wasOpen)menu.focus();}});
 document.addEventListener('click',event=>{if(header&&!header.contains(event.target))close();document.querySelectorAll('.contribute-menu[open]').forEach(el=>{if(!el.contains(event.target))el.open=false;});});
 if(location.pathname==='/'){
  const hash=location.hash;
  if(['#library','#collections'].includes(hash))location.replace('/moments'+(hash==='#collections'?'#collections':''));
  else if(hash==='#news'||hash==='#fandom-feeds')location.replace('/updates');
  else if(['#about-jeolee','#jeo-profile','#gehlee-profile','#fandoms'].includes(hash))location.replace('/about'+hash);
  else if(hash==='#browse')history.replaceState(null,'','/');
 }
})();

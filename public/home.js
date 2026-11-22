'use strict';
(() => {
 const S=window.SiteUI,$=s=>document.querySelector(s),data=window.jeoleeHub,track=$('#hub-update-list');
 function position(){const cards=[...track.children],box=track.getBoundingClientRect(),visible=cards.map((el,i)=>({i,box:el.getBoundingClientRect()})).filter(x=>x.box.right>box.left+4&&x.box.left<box.right-4);$('#hub-previous').disabled=track.scrollLeft<3;$('#hub-next').disabled=track.scrollLeft>=track.scrollWidth-track.clientWidth-3;const text=visible.length?(visible[0].i+1)+'–'+(visible.at(-1).i+1)+' of '+cards.length+' updates':'';if($('#hub-carousel-position').textContent!==text)$('#hub-carousel-position').textContent=text;}
 function news(items){const list=items.slice(0,3);track.innerHTML=list.map((item,i)=>S.newsCard(item,{compact:true,slide:(i+1)+' of '+list.length})).join('');S.onImageError(track);$('#hub-carousel-controls').hidden=!list.length;requestAnimationFrame(position);}
 const move=d=>track.scrollBy({left:d*((track.firstElementChild?.getBoundingClientRect().width||track.clientWidth)+18),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 $('#hub-previous').addEventListener('click',()=>move(-1));$('#hub-next').addEventListener('click',()=>move(1));track.addEventListener('keydown',event=>{if(event.target===track&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});let frame;track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(position);},{passive:true});new ResizeObserver(position).observe(track);
 async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error();return r.json();}
 news([]);
 async function load(){
  const results=await Promise.allSettled([get('/api/updates'),get('/api/catalog'),get('/api/wiki/pages')]);
  const pages=results[2].status==='fulfilled'?results[2].value.pages:[],community=pages.filter(p=>['News','Trends'].includes(p.topic)).map(p=>S.pageUpdate(p)),saved=results[0].status==='fulfilled'?results[0].value.items:[];
  const all=S.mergeUpdates(saved,community);news(all);$('#home-news-status').textContent=all.length?'Newest saved story: '+S.date(all[0].createdAt||all[0].date)+'.':results[0].status==='rejected'?'Saved updates couldn’t load. Open Updates to try again.':'No saved stories yet.';
  if(results[1].status==='fulfilled'){
   const clips=results[1].value.items.filter(item=>item.kind==='clip'&&item.duration&&!(item.mediaIndex>1)),preferred=['video-2117816183944847757','video-2119814577080992152','video-2121988319500546397'];const chosen=[...preferred.map(id=>clips.find(c=>c.id===id)).filter(Boolean),...clips].filter((item,i,list)=>list.findIndex(v=>v.id===item.id)===i).slice(0,4);
   $('#home-moments').innerHTML=chosen.map(item=>'<a class="home-moment" href="/moments?clip='+encodeURIComponent(item.id)+'">'+S.picture(item.image,'')+'<h3>'+S.escape(item.title)+'</h3><p>'+S.escape(item.duration)+(item.creator?' · @'+S.escape(item.creator.handle):'')+'</p></a>').join('');$('#home-moments-status').textContent=chosen.length?'':'The collection is ready for its next moment.';S.onImageError($('#home-moments'));
  }else $('#home-moments-status').innerHTML='The preview couldn’t load. <a href="/moments">Open Moments to try again</a>.';
  const reference=pages.filter(p=>!['News','Trends'].includes(p.topic)).slice(0,3);
  $('#home-pages').innerHTML=reference.map(page=>'<article><h3><a href="/cupids#page='+encodeURIComponent(page.id)+'">'+S.escape(page.title)+'</a></h3><p>'+S.escape(page.summary)+'</p></article>').join('');
  $('#home-pages-status').textContent=reference.length?'':results[2].status==='fulfilled'?'Help build our first song guides, timelines, and fan references. Every page is reviewed before publishing.':'Approved-page previews couldn’t load. You can still open Cupids’ Space.';
 }
 load();
})();

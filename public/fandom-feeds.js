export const FANDOM_ACCOUNTS=[{handle:'jeoleenation',name:'Jeolee Nation'},{handle:'official_jeolee',name:'Jeolee Official'},{handle:'withjeolee',name:'With Jeolee'}];
const halfDay=12*60*60*1000,manilaOffset=8*60*60*1000;
export const feedRefreshWindow=(now=Date.now())=>Math.floor((now+manilaOffset)/halfDay);
export const nextFeedRefreshAt=(now=Date.now())=>(feedRefreshWindow(now)+1)*halfDay-manilaOffset;
export function timelineFrameReady(frame){const rect=frame?.getBoundingClientRect?.();return !!rect&&rect.width>80&&rect.height>80&&!frame.hidden&&frame.style?.visibility!=='hidden'&&frame.style?.display!=='none'&&frame.getAttribute?.('aria-hidden')!=='true';}
if(typeof document!=='undefined'){
 const refreshButton=document.getElementById('refresh-fandom-feed'),section=document.getElementById('fandom-feeds'),panel=document.getElementById('fandom-feed-panel'),host=document.getElementById('fandom-feed'),status=document.getElementById('fandom-feed-status'),source=document.getElementById('fandom-feed-source');
 let active=0,generation=0,seen=false,loadedWindow=null,refreshTimer;
 const tabs=FANDOM_ACCOUNTS.map((account,index)=>{const button=document.createElement('button');button.type='button';button.id='fandom-tab-'+index;button.setAttribute('role','tab');button.setAttribute('aria-controls','fandom-feed-panel');button.textContent=account.name;button.addEventListener('click',()=>{active=index;render();});button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();active=event.key==='Home'?0:event.key==='End'?FANDOM_ACCOUNTS.length-1:(active+(event.key==='ArrowRight'?1:-1)+FANDOM_ACCOUNTS.length)%FANDOM_ACCOUNTS.length;tabs[active].focus();render();});return button;});
 document.getElementById('fandom-feed-tabs').replaceChildren(...tabs);
 function showSelection(){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===active));tab.tabIndex=i===active?0:-1;});panel.setAttribute('aria-labelledby',tabs[active].id);source.href='https://x.com/'+FANDOM_ACCOUNTS[active].handle;source.textContent='View @'+FANDOM_ACCOUNTS[active].handle+' on X';}
 async function render(){
  seen=true;loadedWindow=feedRefreshWindow();const current=++generation,account=FANDOM_ACCOUNTS[active];showSelection();host.hidden=false;host.setAttribute('aria-busy','true');refreshButton.disabled=true;refreshButton.textContent='Refreshing…';status.textContent='Loading posts from @'+account.handle+'…';
  const slot=document.createElement('div'),link=document.createElement('a');link.className='twitter-timeline';link.href='https://twitter.com/'+account.handle;link.textContent='Posts by @'+account.handle;link.setAttribute('data-theme','dark');link.setAttribute('data-height','560');link.setAttribute('data-chrome','noheader nofooter noborders');link.setAttribute('data-dnt','true');slot.append(link);host.replaceChildren(slot);
  let timer,observer;const ready=()=>[...slot.querySelectorAll('iframe')].some(timelineFrameReady);
  const unavailable=()=>{observer?.disconnect();clearTimeout(timer);if(current!==generation)return;host.hidden=true;host.setAttribute('aria-busy','false');refreshButton.disabled=false;refreshButton.textContent='Refresh feed';status.textContent='X isn’t showing this timeline here right now. Use the account link above to view its posts.';};
  const finish=()=>{if(current!==generation){clearTimeout(timer);observer?.disconnect();return;}if(ready()){status.textContent='';host.setAttribute('aria-busy','false');refreshButton.disabled=false;refreshButton.textContent='Refresh feed';clearTimeout(timer);observer?.disconnect();}};
  try{
   observer=new MutationObserver(finish);observer.observe(slot,{childList:true,subtree:true,attributes:true,attributeFilter:['style','width','height','hidden','aria-hidden']});timer=setTimeout(()=>{if(ready())finish();else unavailable();},15000);
   if(typeof window.loadWidgets==='function')await window.loadWidgets();
   if(current!==generation){clearTimeout(timer);observer.disconnect();return;}
   if(!window.twttr?.widgets?.load)throw new Error('X widgets are unavailable.');await Promise.resolve(window.twttr.widgets.load(slot));finish();
  }catch{unavailable();}
 }
 function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(seen&&document.visibilityState==='visible')render();schedule();},Math.max(100,nextFeedRefreshAt()-Date.now()+100));}
 refreshButton.addEventListener('click',render);
 document.addEventListener('visibilitychange',()=>{if(seen&&document.visibilityState==='visible'&&loadedWindow!==feedRefreshWindow())render();});
 showSelection();schedule();
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();render();}},{rootMargin:'150px'});observer.observe(section);}else render();
}

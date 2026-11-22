(()=>{
 const list=document.querySelector('#admin-story-list');
 const note=document.querySelector('#admin-story-status');
 const more=document.querySelector('#admin-story-more');
 const tabs=[...document.querySelectorAll('[data-story-status]')];
 let status='pending',offset=0,sequence=0;

 async function request(path,options){
  const response=await fetch('/api/admin/stories'+path,options);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error);
  return data;
 }

 function appendStory(item){
  const row=document.createElement('article');
  row.className='admin-story-row';
  const heading=document.createElement('h2');
  heading.textContent=item.title;
  const byline=document.createElement('p');
  byline.textContent=item.username||'Anonymous';
  const body=document.createElement('p');
  body.className='admin-story-body';
  body.textContent=item.story;
  row.append(heading,byline,body);
  for(const [label,destination] of [['Publish','published'],['Hide','hidden']]){
   if(item.status===destination)continue;
   const button=document.createElement('button');
   button.type='button';
   button.className='button button-outline';
   button.textContent=label;
   button.addEventListener('click',async()=>{
    const current=sequence;
    row.querySelectorAll('button').forEach(control=>control.disabled=true);
    try{
     await request('/'+item.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:destination,revision:item.revision})});
     if(current===sequence)await load();
    }catch(error){
     if(current===sequence)note.textContent=error.message;
     row.querySelectorAll('button').forEach(control=>control.disabled=false);
    }
   });
   row.append(button);
  }
  list.append(row);
 }

 async function load(append=false){
  const current=++sequence;
  if(!append){
   list.replaceChildren();
   offset=0;
   more.hidden=true;
  }
  more.disabled=true;
  note.textContent='Loading stories…';
  try{
   const {items,nextOffset}=await request('?'+new URLSearchParams({status,offset:String(offset)}));
   if(current!==sequence)return;
   items.forEach(appendStory);
   offset=nextOffset;
   more.hidden=nextOffset===null;
   note.textContent=list.childElementCount?'':'No stories in this view.';
  }catch(error){
   if(current===sequence)note.textContent=error.message;
  }finally{
   if(current===sequence)more.disabled=false;
  }
 }

 document.querySelector('[data-admin-area="stories"]').addEventListener('click',()=>load());
 tabs.forEach(tab=>tab.addEventListener('click',()=>{
  status=tab.dataset.storyStatus;
  tabs.forEach(button=>button.setAttribute('aria-pressed',String(button===tab)));
  load();
 }));
 more.addEventListener('click',()=>load(true));
 document.querySelector('#admin-story-refresh').addEventListener('click',()=>load());
 window.addEventListener('admin:locked',()=>{
  sequence++;
  list.replaceChildren();
  note.textContent='';
  more.hidden=true;
 });
})();

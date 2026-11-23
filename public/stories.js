const storyForm=document.querySelector('#story-form');
const formStatus=document.querySelector('#story-form-status');
const storyGrid=document.querySelector('#story-grid');
const loadMore=document.querySelector('#story-more');
const listStatus=document.querySelector('#story-list-status');
const storyCount=document.querySelector('#story-count');
const storyDialog=document.querySelector('#story-dialog');
let offset=0;
let opener=null;

async function openStory(item,envelope){
 if(opener)return;
 opener=envelope;
 envelope.classList.add('is-opening');
 await Promise.allSettled((envelope.getAnimations?.({subtree:true})||[]).map(animation=>animation.finished));
 envelope.classList.remove('is-opening');
 document.querySelector('#story-dialog-title').textContent=item.title;
 document.querySelector('#story-dialog-byline').textContent=item.username||'Anonymous';
 document.querySelector('#story-dialog-body').textContent=item.story;
 storyDialog.showModal();
 document.body.classList.add('dialog-open');
}

storyDialog.addEventListener('close',()=>{
 document.body.classList.remove('dialog-open');
 opener?.focus({preventScroll:true});
 opener=null;
});

function appendStory(item){
 const letter=document.createElement('button');
 letter.type='button';
 letter.className='story-letter';
 letter.setAttribute('aria-haspopup','dialog');
 const slip=document.createElement('span');
 slip.className='story-letter-slip';
 slip.setAttribute('aria-hidden','true');
 const seal=document.createElement('span');
 seal.className='story-letter-seal';
 seal.setAttribute('aria-hidden','true');
 seal.textContent='♥';
 const title=document.createElement('span');
 title.className='story-letter-title';
 title.textContent=item.title;
 const byline=document.createElement('span');
 byline.className='story-letter-byline';
 byline.textContent=item.username||'Anonymous';
 letter.append(slip,seal,title,byline);
 letter.addEventListener('click',()=>openStory(item,letter));
 storyGrid.append(letter);
}

async function loadStories(){
 loadMore.disabled=true;
 try{
  const response=await fetch('/api/stories?offset='+offset);
  if(!response.ok)throw new Error();
  const {items,nextOffset,total}=await response.json();
  if(Number.isSafeInteger(total)){
   storyCount.textContent=total.toLocaleString()+ (total===1?' envelope':' envelopes');
   storyCount.hidden=false;
  }
  items.forEach(appendStory);
  listStatus.textContent=storyGrid.childElementCount?'':'The mailbox is empty. Write the first letter.';
  offset=nextOffset;
  loadMore.hidden=nextOffset===null;
  loadMore.textContent='Load more letters';
 }catch{
  listStatus.textContent='Letters could not be loaded.';
  loadMore.hidden=false;
  loadMore.textContent='Try again';
 }finally{
  loadMore.disabled=false;
 }
}

storyForm.addEventListener('submit',async event=>{
 event.preventDefault();
 const submit=storyForm.querySelector('button');
 submit.disabled=true;
 formStatus.textContent='Sending your story…';
 try{
  const response=await fetch('/api/stories',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(Object.fromEntries(new FormData(storyForm)))
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error);
  storyForm.reset();
  formStatus.textContent='Your letter was sent for review.';
 }catch(error){
  formStatus.textContent=error.message||'Your letter could not be sent. Try again.';
 }finally{
  submit.disabled=false;
 }
});
loadMore.addEventListener('click',loadStories);
loadStories();

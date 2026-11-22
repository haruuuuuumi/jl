const storyForm=document.querySelector('#story-form');
const formStatus=document.querySelector('#story-form-status');
const storyGrid=document.querySelector('#story-grid');
const loadMore=document.querySelector('#story-more');
const listStatus=document.querySelector('#story-list-status');
let offset=0;

function appendStory(item){
 const letter=document.createElement('details');
 letter.className='story-letter';
 const summary=document.createElement('summary');
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
 const body=document.createElement('p');
 body.className='story-letter-body';
 body.textContent=item.story;
 summary.append(seal,title,byline);
 letter.append(summary,body);
 storyGrid.append(letter);
}

async function loadStories(){
 loadMore.disabled=true;
 try{
  const response=await fetch('/api/stories?offset='+offset);
  if(!response.ok)throw new Error();
  const {items,nextOffset}=await response.json();
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

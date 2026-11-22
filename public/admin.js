'use strict';
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={categories:[],items:[]},view='published',search='',category='all',editing=null,setup=false,toastTimer,previewGeneration=0,widgetPromise=null;
function toast(message){clearTimeout(toastTimer);$('#admin-toast').textContent=message;$('#admin-toast').classList.add('visible');toastTimer=setTimeout(()=>$('#admin-toast').classList.remove('visible'),4000);}
async function api(path,body,method='POST'){
 const response=await fetch(path,{method,cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{throw new Error('Please refresh and sign in to the site again.');}
 if(!response.ok){if(response.status===401&&path!=='/api/admin/login'&&path!=='/api/admin/password'){showAuth();}throw new Error(data.error||'This action could not be completed.');}return data;
}
function lockDialogs(){document.body.classList.toggle('dialog-open',$$('dialog[open]').length>0);}
function openDialog(id){const dialog=$('#'+id);if(!dialog.open)dialog.showModal();lockDialogs();}
function closeDialog(id){$('#'+id).close();lockDialogs();}
async function showAuth(){
 window.dispatchEvent(new Event('admin:locked'));
 for(const dialog of $$('dialog[open]'))dialog.close();state={categories:[],items:[]};editing=null;$('#admin-rows').replaceChildren();$('#edit-form').reset();$('#password-form').reset();$('#preview-title').textContent='';$('#preview-credit').replaceChildren();
 $('#admin-password').type=$('#confirm-password').type='password';$('#show-password').checked=false;
 $('#admin-workspace').hidden=true;$('#auth-panel').hidden=false;$('#logout').hidden=true;$('#change-password').hidden=true;$('#password-form').hidden=true;$('#owner-signin').hidden=true;$('#auth-retry').hidden=true;$('#auth-error').textContent='';
 try{
  const session=await api('/api/admin/session',undefined,'GET');
  if(session.authenticated){$('#password-form').reset();await loadWorkspace();return;}
  if(session.requiresOwnerSignIn){$('#auth-title').textContent='Your collection, your call.';$('#auth-description').textContent='Continue with the site owner’s ChatGPT account to open the admin view.';$('#owner-signin').hidden=false;return;}
  setup=session.setupRequired;$('#auth-title').textContent=setup?'Make it yours.':'Welcome back.';$('#auth-description').textContent=setup?'Choose an admin password with at least 12 characters. Only your signed-in owner account can set it.':'Enter your admin password to edit the library and review submissions.';
  $('#password-form').hidden=false;$('#confirm-wrap').hidden=!setup;$('#confirm-password').required=setup;$('#admin-password').minLength=setup?12:1;$('#admin-password').autocomplete=setup?'new-password':'current-password';$('#auth-submit').textContent=setup?'Create password and open admin':'Open admin';$('#admin-password').focus();
 }catch(error){$('#auth-title').textContent='The editor couldn’t open.';$('#auth-description').textContent=error.message;$('#auth-retry').hidden=false;}
}
function updateCategoryOptions(){const selected=$('#admin-category').value;$('#admin-category').innerHTML='<option value="all">All categories</option>'+state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('#admin-category').value=state.categories.some(c=>c.id===selected)?selected:'all';}
async function loadWorkspace(){
 try{state=await api('/api/admin/catalog',undefined,'GET');$('#auth-panel').hidden=true;$('#admin-workspace').hidden=false;$('#logout').hidden=false;$('#change-password').hidden=false;$('#workspace-error').textContent='';updateCategoryOptions();renderRows();const legacy=legacyClips();$('#import-browser-clips').hidden=!legacy.length;window.dispatchEvent(new Event('admin:ready'));}
 catch(error){$('#workspace-error').textContent=error.message;throw error;}
}
function renderRows(){
 for(const status of ['published','pending','rejected','deleted'])$('#count-'+status).textContent=state.items.filter(i=>i.status===status).length;
 $$('[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===view)));
 const filtered=state.items.filter(i=>i.status===view&&(category==='all'||i.categoryIds.includes(category))&&(!search||(i.title+' '+(i.creator?.handle||'')+' '+(i.creator?.name||'')).toLowerCase().includes(search)));
 if(view==='pending')filtered.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 $('#admin-results').textContent=filtered.length+' '+(filtered.length===1?'moment':'moments')+(view==='pending'?' waiting for review':'');
 $('#admin-rows').innerHTML=filtered.map(item=>{
  const actions=view==='published'?`<button data-edit="${esc(item.id)}">Edit</button><button data-change="deleted" data-id="${esc(item.id)}" class="danger">Delete</button>`:view==='deleted'?`<button data-change="published" data-id="${esc(item.id)}">Restore to library</button>`:`<button data-edit="${esc(item.id)}">Review</button><button data-change="published" data-id="${esc(item.id)}" class="approve">Approve</button>${view==='pending'?`<button data-change="rejected" data-id="${esc(item.id)}" class="danger">Reject</button>`:`<button data-change="deleted" data-id="${esc(item.id)}" class="danger">Delete</button>`}`;
  return `<tr><td><div class="admin-moment"><button class="admin-thumb" data-preview="${esc(item.id)}" aria-label="Preview ${esc(item.title)}"><img src="${esc(item.image)}" alt="" loading="lazy"></button><div><button class="admin-name" data-edit="${esc(item.id)}">${esc(item.title)}</button><p class="admin-meta">${item.creator?'@'+esc(item.creator.handle):item.kind==='photo'?'Photo':'X post'}${item.duration?' · '+esc(item.duration):''}</p></div></div></td><td><div class="category-tags">${item.collections.map(name=>`<span>${esc(name)}</span>`).join('')}</div></td><td><div class="row-actions">${actions}</div></td></tr>`;
 }).join('');
 $('#admin-empty').hidden=filtered.length>0;$('.admin-table-wrap').hidden=filtered.length===0;$('#admin-empty-copy').textContent=search?'Try another title or creator.':view==='pending'?'New submissions will appear here before they can enter the library.':view==='deleted'?'Deleted clips can be restored from here.':'No clips match this view.';
}
function paintEditorCategories(selected){$('#edit-categories').innerHTML=state.categories.map(c=>`<label><input type="checkbox" name="categoryId" value="${esc(c.id)}" ${selected.includes(c.id)?'checked':''}>${esc(c.name)}</label>`).join('');}
function openEditor(id){
 editing=state.items.find(i=>i.id===id);if(!editing)return;$('#edit-title').textContent=editing.status==='pending'?'Review clip':'Edit clip';$('#edit-context').textContent=editing.kind==='photo'?'A photo from the collection.':(editing.creator?'Posted by @'+editing.creator.handle+'. ':'')+'Preview the video before publishing.';
 $('#edit-name').value=editing.title;paintEditorCategories(editing.categoryIds);$('#edit-error').textContent='';$('#approve-edit').hidden=!['pending','rejected'].includes(editing.status);$('#reject-edit').hidden=editing.status!=='pending';$('#save-edit').classList.toggle('button-outline',editing.status==='pending');$('#save-edit').classList.toggle('button-red',editing.status!=='pending');openDialog('edit-dialog');
}
async function saveEditor(status){
 const title=$('#edit-name').value.trim(),categoryIds=$$('#edit-categories input:checked').map(i=>i.value);if(!title){$('#edit-error').textContent='Give this moment a title.';return;}if(!categoryIds.length){$('#edit-error').textContent='Choose at least one category.';return;}
 $$('button',$('#edit-form')).forEach(b=>b.disabled=true);
 try{await api('/api/admin/clips/'+encodeURIComponent(editing.id),{title,categoryIds,revision:editing.revision,...(status?{status}:{})},'PATCH');closeDialog('edit-dialog');await loadWorkspace();toast(status==='published'?'Approved and added to the library.':status==='rejected'?'Submission rejected.':'Changes saved for everyone.');}
 catch(error){$('#edit-error').textContent=error.message;}finally{$$('button',$('#edit-form')).forEach(b=>b.disabled=false);}
}
async function changeStatus(id,status,button){const item=state.items.find(i=>i.id===id);if(!item)return;button.disabled=true;try{await api('/api/admin/clips/'+encodeURIComponent(id),{revision:item.revision,status},'PATCH');await loadWorkspace();toast(status==='deleted'?'Moved to Trash. You can restore it there.':status==='rejected'?'Submission rejected.':view==='deleted'?'Restored to the library.':'Approved and added to the library.');}catch(error){$('#workspace-error').textContent=error.message;button.disabled=false;}}
function loadXWidgets(){
 if(window.twttr?.widgets?.createTweet)return Promise.resolve(window.twttr);if(widgetPromise)return widgetPromise;
 widgetPromise=new Promise((resolve,reject)=>{let done=false;const finish=()=>{if(done)return;if(window.twttr?.widgets?.createTweet){done=true;clearTimeout(timer);resolve(window.twttr);}else if(window.twttr?.ready)window.twttr.ready(finish);};const timer=setTimeout(()=>{done=true;widgetPromise=null;reject(new Error('The X player could not load.'));},15000);const script=document.createElement('script');script.src='https://platform.twitter.com/widgets.js';script.async=true;script.onload=finish;script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);widgetPromise=null;reject(new Error('The X player could not load.'));};document.head.append(script);});return widgetPromise;
}
async function previewItem(id){
 const item=state.items.find(i=>i.id===id);if(!item)return;const generation=++previewGeneration,area=$('#preview-media');area.replaceChildren();$('#preview-title').textContent=item.title;$('#preview-type').textContent=(item.status==='pending'?'Awaiting review':item.status==='published'?'In the library':item.status==='deleted'?'In Trash':'Rejected')+' · '+(item.duration||item.kind);$('#preview-note').textContent=item.mediaCount>1?'X’s embedded player starts with the first video of this multi-video post. The original link opens the selected part.':'';
 $('#preview-credit').innerHTML=(item.creator?`<span>${esc(item.creator.name)} · @${esc(item.creator.handle)}</span>`:'<span>Jeolee collection</span>')+(item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Original on X</a>`:'');openDialog('admin-preview');
 if(item.kind==='photo'){const img=document.createElement('img');img.src=item.image;img.alt=item.title;area.append(img);return;}
 const loading=document.createElement('p');loading.className='embed-status';loading.setAttribute('role','status');loading.textContent='Loading this moment…';area.append(loading);const target=document.createElement('div');target.className='x-video-embed';area.append(target);let expire;
 try{const post=new URL(item.url).pathname.match(/\/status\/(\d+)/);if(!post)throw new Error('Use the original source link to view this post.');const twitter=await loadXWidgets();if(generation!==previewGeneration)return;const result=await Promise.race([twitter.widgets.createTweet(post[1],target,{theme:'dark',dnt:true,conversation:'none',width:550,mediaMaxWidth:800,align:'center'}),new Promise((_,reject)=>{expire=setTimeout(()=>reject(new Error('The X player took too long to load.')),20000);})]);clearTimeout(expire);if(generation!==previewGeneration){target.remove();return;}if(!result)throw new Error('This post is unavailable in the X player.');loading.remove();result.title=item.title+' — preview';}
 catch(error){clearTimeout(expire);if(generation!==previewGeneration)return;target.remove();loading.textContent=error.message;}
}
function legacyClips(){try{const clips=JSON.parse(localStorage.getItem('jeolee-clips-v1'));return Array.isArray(clips)?clips.filter(c=>c&&typeof c.url==='string'&&typeof c.title==='string'):[];}catch{return [];}}
document.addEventListener('click',event=>{
 const status=event.target.closest('[data-status]');if(status){view=status.dataset.status;renderRows();return;}
 const edit=event.target.closest('[data-edit]');if(edit){openEditor(edit.dataset.edit);return;}
 const preview=event.target.closest('[data-preview]');if(preview){previewItem(preview.dataset.preview);return;}
 const change=event.target.closest('[data-change]');if(change){changeStatus(change.dataset.id,change.dataset.change,change);return;}
 const close=event.target.closest('[data-close]');if(close)closeDialog(close.dataset.close);
});
for(const dialog of $$('dialog')){dialog.addEventListener('close',()=>{if(dialog.id==='admin-preview'){previewGeneration++;$('#preview-media').replaceChildren();}if(dialog.id==='edit-dialog')editing=null;if(dialog.id==='password-dialog')$('#change-password-form').reset();lockDialogs();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
$('#password-form').addEventListener('submit',async event=>{event.preventDefault();const password=$('#admin-password').value;if(setup&&password!==$('#confirm-password').value){$('#auth-error').textContent='The passwords don’t match.';return;}$('#auth-submit').disabled=true;$('#auth-error').textContent='';try{await api(setup?'/api/admin/setup':'/api/admin/login',{password});$('#password-form').reset();await loadWorkspace();}catch(error){$('#auth-error').textContent=error.message;}finally{$('#auth-submit').disabled=false;}});
$('#show-password').addEventListener('change',e=>{for(const id of ['admin-password','confirm-password'])$('#'+id).type=e.target.checked?'text':'password';});
$('#generate-password').addEventListener('click',()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#_-+';const password=Array.from(crypto.getRandomValues(new Uint8Array(28)),b=>alphabet[b%alphabet.length]).join('');$('#admin-password').value=password;$('#confirm-password').value=password;$('#show-password').checked=true;$('#admin-password').type=$('#confirm-password').type='text';});
$('#auth-retry').addEventListener('click',showAuth);
$('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{});await showAuth();}catch(error){toast(error.message);}});
$('#admin-search').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();renderRows();});$('#admin-category').addEventListener('change',e=>{category=e.target.value;renderRows();});$('#refresh-admin').addEventListener('click',()=>loadWorkspace().catch(error=>toast(error.message)));
$('#edit-form').addEventListener('submit',e=>{e.preventDefault();saveEditor();});$('#approve-edit').addEventListener('click',()=>saveEditor('published'));$('#reject-edit').addEventListener('click',()=>saveEditor('rejected'));$('#preview-edit').addEventListener('click',()=>{if(editing)previewItem(editing.id);});
function openCategory(){ $('#category-form').reset();$('#category-error').textContent='';openDialog('category-dialog');}
$('#new-category').addEventListener('click',openCategory);$('#new-category-in-editor').addEventListener('click',openCategory);
$('#category-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('button[type=submit]',event.target);button.disabled=true;try{const created=await api('/api/admin/categories',{name:$('#category-name').value.trim()});const checked=$$('#edit-categories input:checked').map(i=>i.value);state.categories.push(created);updateCategoryOptions();if(editing)paintEditorCategories([...checked,created.id]);renderRows();closeDialog('category-dialog');toast('Category created.');}catch(error){$('#category-error').textContent=error.message;}finally{button.disabled=false;}});
$('#change-password').addEventListener('click',()=>{$('#password-error').textContent='';openDialog('password-dialog');});
$('#change-password-form').addEventListener('submit',async event=>{event.preventDefault();if($('#new-password').value!==$('#new-password-confirm').value){$('#password-error').textContent='The new passwords don’t match.';return;}const button=$('button[type=submit]',event.target);button.disabled=true;try{await api('/api/admin/password',{currentPassword:$('#current-password').value,password:$('#new-password').value});closeDialog('password-dialog');toast('Password updated. Other admin sessions have been signed out.');}catch(error){$('#password-error').textContent=error.message;}finally{button.disabled=false;}});
$('#import-browser-clips').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;let added=0,skipped=0;try{for(const item of legacyClips().slice(0,50)){try{const cat=state.categories.find(c=>c.name===(item.category==='Soft hours'?'Just Jeolee':item.category))||state.categories[0];await api('/api/submissions',{url:item.url,title:item.title.slice(0,100),categoryId:cat.id});added++;}catch{skipped++;}}await loadWorkspace();toast(added+' clips sent to review'+(skipped?'; '+skipped+' already present or unavailable.':'.'));}catch(error){toast(error.message);}finally{button.disabled=false;}});
showAuth();

window.addEventListener('admin:expired',showAuth);

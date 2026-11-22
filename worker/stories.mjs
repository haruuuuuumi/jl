const PAGE_SIZE=12;
const statuses=['pending','published','hidden'];

function textField(value,max){
 return typeof value==='string'&&value.length<=max?value.trim():null;
}

export async function storiesApi(request,{db,json,fail,body,write,admin,limit}){
 const {pathname,searchParams}=new URL(request.url);
 const method=request.method;
 const isAdmin=pathname.startsWith('/api/admin/stories');
 if(isAdmin)await admin();

 if(pathname==='/api/stories'&&method==='POST'){
  write();
  await limit();
  const input=await body();
  const title=textField(input.title,100);
  const story=textField(input.story,2400);
  const username=textField(input.username??'',40);
  if(!title||!story||username===null)fail(400,'Add a title and story, and use up to 40 characters for your username.');
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO cupid_stories (id,title,story,username,status,created_at) VALUES (?,?,?,?,'pending',?)")
   .bind(id,title,story,username||null,Date.now()).run();
  return json({id},201);
 }

 if((pathname==='/api/stories'||pathname==='/api/admin/stories')&&method==='GET'){
  const status=isAdmin?searchParams.get('status')??'pending':'published';
  if(!statuses.includes(status))fail(400,'Choose a story status.');
  const offset=Number(searchParams.get('offset')??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)fail(400,'Invalid story page.');
  const fields=isAdmin?'id,title,story,username,status,revision':'id,title,story,username';
  const {results}=await db.prepare('SELECT '+fields+' FROM cupid_stories WHERE status=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?')
   .bind(status,PAGE_SIZE+1,offset).all();
  return json({items:results.slice(0,PAGE_SIZE),nextOffset:results.length>PAGE_SIZE?offset+PAGE_SIZE:null});
 }

 const edit=/^\/api\/admin\/stories\/([a-f0-9-]{36})$/.exec(pathname);
 if(edit&&method==='PATCH'){
  write();
  const {status,revision}=await body();
  if(!['published','hidden'].includes(status)||!Number.isSafeInteger(revision)||revision<1)fail(400,'Choose a story action.');
  const result=await db.prepare('UPDATE cupid_stories SET status=?,revision=revision+1 WHERE id=? AND revision=?')
   .bind(status,edit[1],revision).run();
  if(!result.meta.changes)fail(409,'This story changed. Refresh and try again.');
  return json({ok:true});
 }
 fail(404,'This story action was not found.');
}

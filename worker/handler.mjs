import {getToken,extractVideo} from './video.mjs';
import {catalogApi} from './catalog.mjs';
export {getToken,extractVideo} from './video.mjs';
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':status === 200 ? 'public, max-age=3600' : 'no-store','x-content-type-options':'nosniff'}
});
export async function handleRequest(request, env, ctx, assets, baseline=[]) {
  const catalogResponse=await catalogApi(request,env,baseline);
  if(catalogResponse)return catalogResponse;
  const url = new URL(request.url);
  if(url.pathname==='/cupids/')return new Response(null,{status:308,headers:{location:'/cupids','cache-control':'no-store'}});
  if(url.pathname==='/admin/')return new Response(null,{status:308,headers:{location:'/admin','cache-control':'no-store'}});
  if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  if(url.pathname === '/api/video') {
    const id = url.searchParams.get('id') || '';
    const rawPart = url.searchParams.get('part');
    if(!/^\d{10,25}$/.test(id) || (rawPart !== null && !/^[1-4]$/.test(rawPart))) return json({error:'Use a valid X video post link.'},400);
    try {
      const remote = new URL('https://cdn.syndication.twimg.com/tweet-result');
      remote.search = new URLSearchParams({id,lang:'en',token:getToken(id)});
      const response = await fetch(remote.href,{headers:{accept:'application/json','user-agent':'JeoleeOnRepeat/1.0'},signal:AbortSignal.timeout(12000)});
      if(!response.ok) return json({error:'This public video is unavailable. Try the original post on X.'},response.status === 429 ? 429 : 404);
      const video = extractVideo(await response.json(),id,rawPart ? Number(rawPart) : null);
      if(!video) return json({error:'No playable public video was found in this post.'},404);
      return json(video);
    } catch {return json({error:'The video could not be checked right now. Please try again.'},502);}
  }
  const path = url.pathname === '/' ? '/index.html' : ['/admin','/admin/'].includes(url.pathname)?'/admin.html':url.pathname==='/cupids'?'/cupids.html':url.pathname==='/because-of-jeolee'?'/because-of-jeolee.html':url.pathname;
  const asset = assets[path];
  if(!asset) return new Response('Not found',{status:404});
  const headers = {'content-type':asset.type,'cache-control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff','etag':asset.etag,'referrer-policy':'same-origin'};
  if(path==='/admin.html')headers['cache-control']='no-store';
  if(request.headers.get('if-none-match') === asset.etag) return new Response(null,{status:304,headers});
  const bytes = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.base64),c => c.charCodeAt(0));
  return new Response(bytes,{headers});
}

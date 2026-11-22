import {handleRequest} from '../worker/handler.mjs';
import {baseline} from './build/catalog.mjs';
import {validAdminSession} from '../worker/catalog.mjs';
const deny=(text,status)=>new Response(text,{status,headers:{'cache-control':'no-store','content-type':'text/plain; charset=utf-8','x-content-type-options':'nosniff'}});
export function createApp(options={}){
 return {async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.origin!==env.SITE_ORIGIN)return deny('This hostname is not configured for this site.',403);
  // Canonicalize before deciding which routes need owner authentication.
  // Encoded aliases must not let the Static Assets binding serve admin files.
  let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return deny('Invalid URL path.',400);}
  const canonical=new URL(url);canonical.pathname=decoded.replace(/\\/g,'/').replace(/\/{2,}/g,'/');
  if(canonical.href!==url.href)return new Response(null,{status:308,headers:{location:canonical.href,'cache-control':'no-store'}});
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-'))headers.delete(name);
  let routed=new Request(request,{headers});
  const admin=url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/admin')||url.pathname==='/signin-with-chatgpt';
  const runtime={...env,ADMIN_AUTH_MODE:'password'};
  const authenticated=admin&&await validAdminSession(routed,runtime);
  const authEndpoint=['/api/admin/session','/api/admin/login','/api/admin/logout'].includes(url.pathname);
  if(url.pathname.startsWith('/api/admin')&&!authEndpoint&&!authenticated)return new Response(JSON.stringify({error:'Sign in to use admin.'}),{status:401,headers:{'content-type':'application/json','cache-control':'no-store'}});
  const adminPage=['/admin','/admin/','/admin.html'].includes(url.pathname);
  if(admin&&!adminPage&&!authEndpoint&&!authenticated&&url.pathname!=='/signin-with-chatgpt')return deny('Sign in to use admin.',401);
  if(url.pathname.startsWith('/api/'))return handleRequest(routed,runtime,ctx,{},baseline);
  if(url.pathname==='/signin-with-chatgpt')return Response.redirect(new URL('/admin',url),303);
  if(url.pathname==='/admin/'||url.pathname==='/cupids/'||url.pathname==='/about/')return new Response(null,{status:308,headers:{location:url.pathname.slice(0,-1),'cache-control':'no-store'}});
  if(!['GET','HEAD'].includes(routed.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store'}});
  const path=adminPage?(authenticated?'/admin.html':'/admin-login.html'):url.pathname==='/'?'/index.html':url.pathname==='/cupids'?'/cupids.html':url.pathname==='/about'?'/about.html':url.pathname;
  // Visitors can browse and contribute anonymously. Admin files and APIs require
  // the password session. No visitor or owner account sign-in is required.
  // The build excludes source catalogs, provenance JSON and migration SQL.
  if(!env.ASSETS)return deny('Site assets are not available.',503);
  const assetURL=new URL(path,url.origin),assetRequest=new Request(assetURL,routed);
  const asset=await env.ASSETS.fetch(assetRequest),responseHeaders=new Headers(asset.headers);
  responseHeaders.set('cache-control',!admin&&path.startsWith('/assets/')?'public, max-age=86400':'no-store');
  responseHeaders.set('x-content-type-options','nosniff');responseHeaders.set('referrer-policy','same-origin');
  return new Response(routed.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers:responseHeaders});
 }};
}
export default createApp();

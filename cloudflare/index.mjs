import {handleRequest} from '../worker/handler.mjs';
import {baseline} from './build/catalog.mjs';
import {accessConfiguration,verifiedOwnerRequest} from './access.mjs';
const deny=(text,status)=>new Response(text,{status,headers:{'cache-control':'no-store','content-type':'text/plain; charset=utf-8','x-content-type-options':'nosniff'}});
export function createApp(options={}){
 return {async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.origin!==env.SITE_ORIGIN)return deny('This hostname is not configured for this site.',403);
  try{accessConfiguration(env);}catch{return deny('The private site is waiting for its Cloudflare Access setup.',503);}
  let owner;
  try{owner=await verifiedOwnerRequest(request,env,options.resolveKeySet);}catch{return deny('Your Cloudflare Access session could not be verified.',403);}
  if(!owner)return deny('Sign in with the site owner’s Cloudflare Access account.',403);
  if(url.pathname.startsWith('/api/'))return handleRequest(owner,env,ctx,{},baseline);
  if(url.pathname==='/signin-with-chatgpt')return Response.redirect(new URL('/admin',url),303);
  if(url.pathname==='/admin/'||url.pathname==='/cupids/')return new Response(null,{status:308,headers:{location:url.pathname.slice(0,-1),'cache-control':'no-store'}});
  if(!['GET','HEAD'].includes(owner.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD','cache-control':'no-store'}});
  const path=url.pathname==='/'?'/index.html':url.pathname==='/admin'?'/admin.html':url.pathname==='/cupids'?'/cupids.html':url.pathname;
  // Static assets always run behind the signed owner check, including images/JS.
  // Never expose the baseline source catalogs, provenance JSON, or migration SQL.
  if(!env.ASSETS)return deny('Site assets are not available.',503);
  const assetURL=new URL(path,url.origin),assetRequest=new Request(assetURL,owner);
  const asset=await env.ASSETS.fetch(assetRequest),headers=new Headers(asset.headers);
  headers.set('cache-control',path.startsWith('/assets/')?'private, max-age=86400':'no-store');
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','same-origin');
  return new Response(owner.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers});
 }};
}
export default createApp();

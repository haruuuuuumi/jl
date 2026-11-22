import {createRemoteJWKSet,jwtVerify} from 'jose';
const keySets=new Map();
export function accessConfiguration(env){
 const team=String(env.ACCESS_TEAM_DOMAIN||'').toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(team)||!env.ACCESS_AUD||!env.ADMIN_OWNER_EMAIL||!env.ADMIN_AUTH_SECRET)throw new Error('Cloudflare Access is not configured.');
 const issuer='https://'+team;
 return {issuer,audience:String(env.ACCESS_AUD),owner:String(env.ADMIN_OWNER_EMAIL).trim().toLowerCase()};
}
export async function verifiedOwnerRequest(request,env,resolveKeySet){
 const config=accessConfiguration(env),token=request.headers.get('cf-access-jwt-assertion');
 if(!token)return null;
 let keySet;
 if(resolveKeySet)keySet=resolveKeySet(config.issuer);
 else{if(!keySets.has(config.issuer))keySets.set(config.issuer,createRemoteJWKSet(new URL('/cdn-cgi/access/certs',config.issuer),{timeoutDuration:5000}));keySet=keySets.get(config.issuer);}
 const {payload}=await jwtVerify(token,keySet,{issuer:config.issuer,audience:config.audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email']});
 const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():'';
 if(email!==config.owner||typeof payload.sub!=='string'||!payload.sub)return null;
 // The existing admin engine receives identity only after signed Access validation.
 // Incoming Sites identity headers can never grant privileges on this host.
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-'))headers.delete(name);
 headers.set('oai-authenticated-user-id','cloudflare-access:'+payload.sub);
 headers.set('oai-authenticated-user-email',email);
 return new Request(request,{headers});
}

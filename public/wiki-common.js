'use strict';
window.WikiUI={
 escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 date:value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value)),
 bodyHTML(text){let heading=0;return String(text||'').split(/\n\s*\n/).filter(Boolean).map(block=>{const match=block.match(/^##?\s+(.+)$/);return match?'<h2 id="section-'+(++heading)+'">'+this.escape(match[1])+'</h2>':'<p>'+this.escape(block).replaceAll('\n','<br>')+'</p>';}).join('');},
 sourcesHTML(sources){return '<ol>'+sources.map(url=>'<li><a href="'+this.escape(url)+'" target="_blank" rel="noopener noreferrer">'+this.escape(new URL(url).hostname+new URL(url).pathname)+'</a></li>').join('')+'</ol>';},
 async request(path,body,method='POST'){const response=await fetch(path,{method,cache:'no-store',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw new Error('This page couldn’t load. Refresh and try again.');}if(!response.ok){const error=new Error(data.error||'Please try again.');error.status=response.status;throw error;}return data;}
};

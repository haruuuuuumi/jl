// Build-time source of the original curated collection; not a browser data store.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
export async function readBaseline(root){
 const context={};vm.createContext(context);
 const sources=await Promise.all(['catalog.js','media-catalog.js','collection-catalog.js'].map(n=>readFile(resolve(root,'public',n),'utf8')));
 vm.runInContext(sources.join('\n')+'\nglobalThis.data={clipCatalog,videoMedia,fanEditCatalog,collectionCatalog,excludedCollectionMediaKeys};',context);
 const {clipCatalog,videoMedia,fanEditCatalog,collectionCatalog,excludedCollectionMediaKeys}=context.data;
 const items=clipCatalog.map(([title,url,duration])=>{const key=url.split('/status/')[1],parts=key.split('/video/'),media=videoMedia[key]||{};return {...media,id:'video-'+parts[0]+(parts[1]?'-'+parts[1]:''),title,url,duration,mediaIndex:parts[1]?Number(parts[1]):media.mediaIndex,category:'Just Jeolee',kind:'clip',image:media.image||'assets/together.png'};});
 items.push(...fanEditCatalog,
 {id:'first-replay',title:'The Jeolee thread',category:'Just Jeolee',kind:'clip',image:'assets/couch.png',url:'https://x.com/abby88308703/status/2124129578931356055',description:'The starting post for @abby88308703’s Jeolee video thread. Open it on X to explore the individual clips.'},
 {id:'between-breaks',title:'Between breaks',category:'Just Jeolee',kind:'photo',image:'assets/close-up.png',description:'A photo from the Jeolee collection.'},
 {id:'little-things',title:'The little things',category:'Just Jeolee',kind:'photo',image:'assets/little-things.png',description:'A photo from the Jeolee collection. Original photo credit is preserved in the image.'},
 {id:'just-jeolee',title:'Just Jeolee',category:'Just Jeolee',kind:'photo',image:'assets/together.png',description:'A photo from the Jeolee collection.'},
 {id:'closer',title:'A little closer',category:'Just Jeolee',kind:'photo',image:'assets/couch.png',description:'A photo from the Jeolee collection.'});
 for(const entry of collectionCatalog){const existing=items.find(i=>i.mediaKey===entry.mediaKey);if(existing)existing.collections=[...new Set([existing.category,...(existing.collections||[]),entry.category])];else items.push(entry);}
 return JSON.parse(JSON.stringify(items.filter(i=>!excludedCollectionMediaKeys.includes(i.mediaKey))));
}

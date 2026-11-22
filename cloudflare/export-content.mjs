import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=new URL('../.cloudflare-data/content-snapshot.json',import.meta.url),destination=new URL('../.cloudflare-data/content.sql',import.meta.url);
const allowed=['catalog_categories','catalog_entries','wiki_pages','wiki_proposals'];const snapshot=JSON.parse(await readFile(source,'utf8'));
const name=value=>{if(!/^[a-z_]+$/.test(value))throw new Error('Invalid SQL identifier.');return '"'+value+'"';};
const value=v=>v===null?'NULL':typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":(()=>{throw new Error('Unsupported database value.');})();
let sql='-- Jeolee content snapshot; import once into the NEW empty Cloudflare D1 database.\n-- Does not contain passwords, sessions, secrets or rate-limit records.\n';let count=0;
for(const table of allowed){const data=snapshot.tables[table];if(!data)throw new Error('Snapshot is incomplete.');for(const row of data.rows){sql+='INSERT INTO '+name(table)+' ('+data.columns.map(name).join(',')+') VALUES ('+data.columns.map(k=>value(row[k])).join(',')+');\n';count++;}}
await mkdir(new URL('../.cloudflare-data/',import.meta.url),{recursive:true});await writeFile(destination,sql);console.log(`Prepared ${count} content override rows; original baseline comes from the Worker build. Authentication starts fresh on the new host.`);

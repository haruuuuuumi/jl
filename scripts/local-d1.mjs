// Preview/test adapter only. Production uses the real env.DB D1 binding.
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
export async function localD1(filename=':memory:'){
 if(filename!==':memory:')await mkdir(dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec('CREATE TABLE IF NOT EXISTS __preview_migrations (tag TEXT PRIMARY KEY)');
 const root=resolve(import.meta.dirname,'..');
 const journal=JSON.parse(await readFile(resolve(root,'drizzle/meta/_journal.json'),'utf8'));
 for(const entry of journal.entries){if(sqlite.prepare('SELECT tag FROM __preview_migrations WHERE tag=?').get(entry.tag))continue;const sql=await readFile(resolve(root,'drizzle',entry.tag+'.sql'),'utf8');sqlite.exec('BEGIN');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO __preview_migrations VALUES (?)').run(entry.tag);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}}
 const db={prepare(sql){const parameters=[];return {bind(...values){parameters.push(...values);return this;},async run(){const r=sqlite.prepare(sql).run(...parameters);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async all(){return {success:true,results:sqlite.prepare(sql).all(...parameters)};},async first(column){const row=sqlite.prepare(sql).get(...parameters)||null;return column?row?.[column]??null:row;},_run(){const r=sqlite.prepare(sql).run(...parameters);return {success:true,meta:{changes:Number(r.changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s._run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close();},sqlite};return db;
}

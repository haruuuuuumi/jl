// Read-only diagnostic: exactly the same public-page reader used by the Worker cron.
import {collectFandomUpdates} from '../worker/fandom-updates.mjs';
const result=await collectFandomUpdates();
console.log(JSON.stringify({outcome:result.errors.length?(result.posts.length?'partial':'unavailable'):(result.posts.length?'updated':'no_new'),...result},null,2));
if(result.errors.length&&!result.posts.length)process.exitCode=2;

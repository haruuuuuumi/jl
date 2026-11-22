# Cloudflare hosting

Public site: **https://jeoleecupids.com**. Worker: `jl`. Database: `jeolee-cupids`.

Visitors do not log in. `/admin` uses a password stored in the `ADMIN_PASSWORD` runtime Secret. The existing `ADMIN_AUTH_SECRET` is the session security key. Admin sessions use Secure, HttpOnly, SameSite=Strict cookies, are stored as hashes, expire after eight hours and become invalid when the password changes. Login attempts are rate-limited per visitor IP. Moderation writes check the same-origin request and session.

## Setup

1. Use Cloudflare Builds root directory `cloudflare`, build command `npm ci && npm run build`, deploy command `npm run deploy`.
2. Set runtime Secrets `ADMIN_PASSWORD` (12–128 characters) and `ADMIN_AUTH_SECRET` (a strong random value). Keep the existing session key once configured.
3. Remove the dedicated Jeolee Cupids Cloudflare Access application that covers the domain. No Access team, audience tag or owner email is needed.
4. Deploy. Pending D1 schema migrations apply automatically before the Worker publishes. The configured database ID is the one provided by the owner; never substitute another application's database.
5. Visit `/` without a login and `/admin` to enter the admin password. Confirm an anonymous visitor cannot read `/api/admin/catalog` or access the dashboard scripts.

New submissions and Cupid contributions go into review; they do not publish automatically. Public reads expose only published clips and approved pages. Existing edits and deletions are preserved by importing the content-only snapshot once. Do not import authentication tables, sessions or rate-limit records.

## Local commands

```sh
npm ci
npm test
node configure.mjs
node ready.mjs
node bundle.mjs
```

`configure.mjs` uses the recorded D1 ID and accepts an optional `--database-id <UUID>` or `CLOUDFLARE_D1_DATABASE_ID`. `npm run deploy` performs configuration, build checks, schema migrations and deployment. `npm run deploy:local` uses the existing ignored local config. `npm run db:migrate` applies migrations alone.

The build serves an allowlist of static files. Source catalogs, provenance JSON and SQL exports are excluded. `run_worker_first` remains enabled to keep dashboard assets and APIs behind the password check. Workers.dev and preview URLs remain disabled; the requested custom domain is used.

Store private content snapshots under the ignored `.cloudflare-data/`. `node export-content.mjs` converts a separately supplied content-snapshot.json into SQL without authentication data. Keep runtime Secrets out of this repository and out of chat.

## Fanbase update carousel

The Worker checks the public pages for `@jeoleenation`, `@official_jeolee`, and `@withjeolee` at 12 noon and 12 midnight Asia/Manila. Wrangler cron `0 4,16 * * *` uses UTC and runs even when the site is closed. New cron changes may take several minutes to propagate.

`worker/fandom-updates.mjs` is the shared reader. It reads ordinary public profile HTML for original post links, then checks the post author, ID, text, original date and original media through public syndication metadata. Each check publishes up to three newest verified posts across the three accounts, with source credit. It deduplicates by post ID and keeps previous cards in D1. Pinned older posts do not displace newer posts when dates are available. Original-post images are used only when returned by the source; text-only posts remain text cards.

This free reader is **best effort**: public X pages may return HTTP 403/429, a login screen, or HTML without post links. There is no guaranteed public timeline API here. Failed checks keep saved stories, record the reason in admin, and honor rate-limit backoff. No browser login, proxy, fingerprint spoofing, paid API, or private credentials are used. A failed check never stamps old stories as new. Read-only diagnostic using the exact same reader:

```sh
node scripts/check-fandom-updates.mjs
```

Admin has **Fanbase updates → Check now**. It uses the existing password session and same-origin protection; visitors cannot trigger unlimited refreshes. Checks have a database lease and one-minute manual cooldown, plus source-requested backoff. The first public `/api/updates` request can start one initial check after deployment, then cron owns recurring checks. Refreshing the page only reads saved cards. The public endpoint omits diagnostic details and secrets. The one owner-supplied post in `FANDOM_BOOTSTRAP_POSTS` is also checked as a first-card candidate through the same verification; it is never published without readable source metadata.

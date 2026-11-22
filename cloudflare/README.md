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

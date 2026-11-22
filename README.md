# Jeolee Cupids

A public pink-and-black Jeolee fan hub: Just Jeolee, Tinginan serye, Their soundtrack, Fan edits, news and Cupids’ Space. Visitors can browse and submit without an account. Clips and page contributions stay pending until the admin approves them.

**Admin uses one password.** `/admin` shows a password form; dashboard HTML, scripts and moderation APIs require a valid HttpOnly session. There is no visitor login, owner-account login or Cloudflare Access requirement.

## Cloudflare deployment

| Setting | Value |
| --- | --- |
| Worker | `jl` |
| Branch | `main` |
| Root directory | `cloudflare` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npm run deploy` |
| Domain | `jeoleecupids.com` |

Set these **runtime Secrets** in Workers & Pages → jl → Settings → Variables and Secrets:

- `ADMIN_PASSWORD`: your chosen admin password, 12–128 characters.
- `ADMIN_AUTH_SECRET`: the existing random session security key; keep it stable.

Enter secrets only in Cloudflare. Never commit them or put them in browser code. The admin password can be changed by updating `ADMIN_PASSWORD`; this invalidates existing admin sessions. No first-visitor password setup is enabled.

Delete the dedicated **Jeolee Cupids** application in **Zero Trust → Access controls → Applications**, or remove its public-hostname destination for this domain. It was created to gate the entire site and is no longer needed. Keep unrelated applications and policies unchanged. The app itself protects admin with the password session.

The new D1 database `jeolee-cupids` is configured with the owner-provided ID. Deployments apply versioned schema migrations before publishing and do not reset content. No build-time variables are required; `CLOUDFLARE_D1_DATABASE_ID` is an optional override. Workers.dev and preview URLs remain disabled.

If Cloudflare reports Framework: Static or runs only `npx wrangler deploy`, use the build settings above. The root Wrangler file rejects static deployment because it would bypass the admin middleware.

## Local checks

Use Node.js 24 LTS:

```sh
npm ci --prefix cloudflare
npm test --prefix cloudflare
node cloudflare/configure.mjs
node cloudflare/bundle.mjs
```

Tests cover public access, password login, protected dashboard assets and APIs, forged/expired sessions, password rotation, login rate limits, pending contributions, approval, and saved catalog overrides. Tests use synthetic credentials and data and do not need Cloudflare account access.

## Content and code

The source baseline has 120 cards. The transferred owner edits and deletions yield 117 published cards. Runtime content, moderation records, password hashes and sessions are excluded from GitHub. Content transfers are private SQL imports, performed once before editing on the new host.

- `public/`: interface, supplied photos, fonts, thumbnails and source catalogs.
- `catalog/`: baseline loader used at build time.
- `worker/`: catalog, moderation, wiki and video APIs.
- `cloudflare/`: hosting adapter, build scripts, configuration and tests.
- `drizzle/`: database migrations.

Source catalogs and provenance JSON are excluded from served static assets. X playback uses an embedded player with creator credit and original-post links; availability depends on X and the original post. Unofficial fan project; media credits and the included font license are retained.

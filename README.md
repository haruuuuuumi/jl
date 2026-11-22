# Jeolee Cupids

A pink-and-black Jeolee fan hub with a video library, **Just Jeolee**, **Tinginan serye**, **Their soundtrack**, **Fan edits**, news, and Cupids’ Space. Includes video submissions, contribution review, title/category editing, Trash/restore, and password-protected administration.

The frontend uses HTML, CSS and JavaScript. Hosting uses **Cloudflare Workers + Static Assets + D1 + Access**. Browsing and all assets remain owner-private until an intentional access change is implemented. This repository contains source code and public media references; credentials, live database content and admin sessions are excluded.

## Build and check

Use Node.js 24 LTS. From the repository root:

```sh
npm ci --prefix cloudflare
npm run build --prefix cloudflare
npm test --prefix cloudflare
node cloudflare/bundle.mjs
```

Tests use synthetic database overrides, including deleted clips and an edited title. No production export or Cloudflare credentials are required for these checks.

## Connect GitHub to Cloudflare

Create a Worker from this repository using these settings:

| Setting | Value |
| --- | --- |
| Worker name | `jl` (matches the existing Cloudflare project) |
| Production branch | `main` |
| Root directory | `cloudflare` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npm run deploy` |
| Custom domain | `jeoleecupids.com` |

If the build log says **Framework: Static**, **Output Directory: public**, or runs only `npx wrangler deploy`, the dashboard is using the repository root and the wrong deploy command. Update the settings above under **jl → Settings → Builds**. The root `wrangler.jsonc` deliberately rejects this setup so it cannot bypass the private Worker. Keep workers.dev and preview URLs disabled.

Before the first deployment:

1. Create a **new D1 database** named `jeolee-cupids` in your account.
2. Create a Cloudflare Access application for `jeoleecupids.com` with an Allow policy for **only your owner email**. Record its team hostname and application audience tag.
3. Add these non-secret build variables in Cloudflare:

   | Variable | Value |
   | --- | --- |
   | `CLOUDFLARE_D1_DATABASE_ID` | Your returned D1 UUID |
   | `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Your `team.cloudflareaccess.com` hostname |
   | `CLOUDFLARE_ACCESS_AUD` | Your Access application's audience tag |

4. Configure a local deployment file and apply the SQL schema, following [the Cloudflare guide](cloudflare/README.md).
5. Set the Worker runtime **secrets** `ADMIN_OWNER_EMAIL` (your allowed email) and `ADMIN_AUTH_SECRET` (a new strong random value). Enter these directly in Cloudflare; never commit them.
6. Deploy, sign in through Access, and create your new-host admin password at `/admin`.

The deployment deliberately fails closed until the real D1 and Access settings and runtime secrets are configured. GitHub stores the source; the domain becomes live only after Cloudflare deployment and verification.

## Content migration

The source catalog includes **120 baseline cards**. The existing hosted site has additional database edits and deletions; its latest checked state had **117 published cards**. Those live overrides, pending submissions, and Cupids’ Space records are **not part of this public repository**. Transfer a fresh content-only SQL export privately before cutover to preserve the current moderated state. The original hosted site remains unchanged.

Never commit `.cloudflare-data/`, SQL content exports, authentication records, session cookies, or environment files. Admin password hashes and sessions are not migrated; initialize administration directly on the protected new host.

## Project layout

- `public/`: interface, supplied photos, fonts, video thumbnails, source catalogs and media provenance.
- `catalog/`: curated baseline loader used at build time.
- `worker/`: catalog, moderation, wiki and video APIs.
- `cloudflare/`: private hosting adapter, build scripts, deployment template and tests.
- `drizzle/`: database schema migrations.

Source catalogs and provenance JSON are excluded from deployed static assets. Video playback uses X's embedded player with creator credit and original-post links; availability depends on X and the original post. The site is an unofficial fan project. Media credits remain in source metadata and images; Pathway Extreme's font license is included.

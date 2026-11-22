# Jeolee Cupids on your Cloudflare account

Target: **https://jeoleecupids.com**. The Cloudflare Worker name is `jl`, matching the project already created in the dashboard; the D1 database remains `jeolee-cupids`. This deployment is independent of ChatGPT Sites and uses Cloudflare Workers, Static Assets, D1 and Access. The original live site is unchanged until cutover.

## Prepared and verified

The approved pink/black UI, all four collections, X playback, submissions, Cupids’ Space and moderation are retained. The source baseline has 120 cards. The existing site had 117 published cards at the last migration check. Its private content snapshot is intentionally excluded from GitHub; obtain a fresh content-only export before importing the current owner edits, Trash and moderation records.

Images/fonts are separate static assets rather than embedded in the Worker JavaScript. Only the existing served-file allowlist is copied. Source catalogs, provenance JSON and private SQL are excluded. The app checks a verified Cloudflare Access assertion before every asset and API request. The existing admin password/session layer remains behind that identity check.

**Access stays private.** There is no public/preview bypass, no default password, and no client-supplied identity header grants access. The Cloudflare owner policy must allow only the original site owner. The Worker stays closed if Access or admin secrets are missing. Workers.dev and preview URLs are disabled.

## Once the Cloudflare account is connected

1. In the Worker’s **Settings → Builds**, use root directory `cloudflare`, build command `npm ci && npm run build`, and deploy command `npm run deploy`. The root Wrangler file blocks accidental static-only deployment. From this directory run `npm ci` and `npm run build`.
2. Create a new empty D1 database in the selected account, named `jeolee-cupids`. Use its exact returned database ID. Do not import into another application's database.
3. Create a self-hosted Cloudflare Access application for `jeoleecupids.com`, with an Allow policy for only the existing site owner's email. Use email one-time PIN or the owner's configured identity provider. Record the returned team hostname and Application Audience tag. No broad email-domain or Everyone policy.
4. Configure the local deployment file using those returned values:

   ```sh
   node configure.mjs --database-id <returned-database-id> --team-domain <your-team.cloudflareaccess.com> --audience <returned-application-audience-tag>
   ```

5. Apply the schema:

   ```sh
   npm run db:migrate
   ```

6. Import the fresh content snapshot once into the NEW empty database:

   ```sh
   npx wrangler d1 execute DB --remote --config wrangler.local.json --file ../.cloudflare-data/content.sql
   ```

7. Set `ADMIN_OWNER_EMAIL` to the original site owner's email and `ADMIN_AUTH_SECRET` to a new strong random value using Cloudflare secrets. Keep values out of Git, screenshots and chat. `wrangler secret put` prompts for a hidden value. Do not rotate the original site's secret.
8. Run `npm run deploy:local` with the locally configured file (or `npm run deploy` in CI using the environment variables documented in the root README). The configured custom domain is `jeoleecupids.com`; do not overwrite conflicting DNS records without reviewing them first. Confirm Cloudflare Access is active before treating the migration as live.
9. Sign in through Cloudflare Access and open `/admin`. **Create the new-host admin password directly in the site.** Old password hashes/sessions are intentionally not copied without their private pepper; content and moderation records are copied. You may choose the same password directly in the protected form if desired. Never send it through chat.
10. Check the homepage, 117 published clips/current owner counts, filters, X player, pending queues, form submission and admin editing. Verify anonymous requests cannot reach either assets or APIs. Keep the original site available until these checks pass.

## Local checks without Cloudflare credentials

From the parent checkout:

```sh
node cloudflare/build.mjs
npm test --prefix cloudflare
node cloudflare/bundle.mjs
```

When privately transferring content, place the snapshot under the ignored `.cloudflare-data/`; run `node cloudflare/export-content.mjs` only if its content-snapshot.json has been supplied separately. The snapshot is never required for tests; no password hashes, sessions, runtime secrets or rate-limit data are included. The schema still creates the authentication tables for first setup on the new host. `cloudflare/test.mjs` uses synthetic content overrides to check edits and deletions, signature/issuer/audience/expiry/owner enforcement, forged-header rejection and private asset routing.

`wrangler.template.json` contains the account ID from the owner's dashboard link and the requested hostname. Real database/Access IDs live only in the ignored `wrangler.local.json`. It deliberately cannot be deployed as-is. Do not use a temporary preview account or publish under a different account.

## References

- [Workers Static Assets and run_worker_first](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Access with Workers and Static Assets limitations](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [D1 imports and exports](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

Static Assets do not propagate `ctx.access` to the user Worker, so this adapter validates the signed JWT header with the account's remote keys instead of trusting an identity header. It validates signature, issuer, audience, expiration and owner email. Existing Sites builds continue using their platform identity and embedded-assets build; no Sites runtime configuration was changed.
